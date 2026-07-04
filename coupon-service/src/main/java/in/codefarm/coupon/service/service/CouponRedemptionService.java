package in.codefarm.coupon.service.service;

import in.codefarm.coupon.service.controller.CouponController;
import in.codefarm.coupon.service.dto.CouponResponse;
import in.codefarm.coupon.service.dto.CreateCouponRequest;
import in.codefarm.coupon.service.dto.RedeemRequest;
import in.codefarm.coupon.service.dto.RedeemResponse;
import in.codefarm.coupon.service.dto.RedemptionResponse;
import in.codefarm.coupon.service.entity.Coupon;
import in.codefarm.coupon.service.entity.CouponRedemption;
import in.codefarm.coupon.service.entity.RedemptionStatus;
import in.codefarm.coupon.service.exception.CouponAlreadyExistsException;
import in.codefarm.coupon.service.exception.CouponNotFoundException;
import in.codefarm.coupon.service.lock.LockStrategy;
import in.codefarm.coupon.service.repository.CouponRedemptionRepository;
import in.codefarm.coupon.service.repository.CouponRepository;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CouponRedemptionService {

    private final Logger logger = LoggerFactory.getLogger(CouponRedemptionService.class);
    private static final String LOCK_KEY_PREFIX = "coupon:lock:";
    private static final long LOCK_TIMEOUT_MS = 5000;
    private static final int MAX_LOCK_RETRIES = 10;
    private static final long INITIAL_RETRY_DELAY_MS = 50;

    private final CouponRepository couponRepository;
    private final CouponRedemptionRepository redemptionRepository;
    private final LockStrategy lockStrategy;
    private final String instanceName;

    public CouponRedemptionService(
            CouponRepository couponRepository,
            CouponRedemptionRepository redemptionRepository,
            LockStrategy lockStrategy,
            @Value("${coupon.instance.name:coupon-app-1}") String instanceName
    ) {
        this.couponRepository = couponRepository;
        this.redemptionRepository = redemptionRepository;
        this.lockStrategy = lockStrategy;
        this.instanceName = instanceName;
    }

    @Transactional
    public CouponResponse createCoupon(CreateCouponRequest request) {
        if (couponRepository.existsByCode(request.code())) {
            logger.error("CouponAlreadyExistsException");
            throw new CouponAlreadyExistsException(request.code());
        }
        Coupon coupon = new Coupon(request.code(), request.totalRedemptions());
        coupon = couponRepository.save(coupon);
        return CouponResponse.from(coupon);
    }

    public Page<CouponResponse> getCoupons(int page, int size) {
        return couponRepository.findAll(PageRequest.of(page, size))
                .map(CouponResponse::from);
    }

    /**
     * Attempts to acquire a distributed lock with exponential backoff retry.
     * Retries up to MAX_LOCK_RETRIES times with increasing delays.
     */
    private boolean acquireLockWithRetry(String lockKey, String lockValue, String couponCode, String username) {
        long delayMs = INITIAL_RETRY_DELAY_MS;
        
        for (int attempt = 0; attempt < MAX_LOCK_RETRIES; attempt++) {
            try {
                boolean acquired = lockStrategy.acquireLock(lockKey, lockValue, LOCK_TIMEOUT_MS);
                if (acquired) {
                    logger.info("[LOCK ACQUIRED] User: {}, Coupon: {}, Attempt: {}/{}, Instance: {}", 
                        username, couponCode, attempt + 1, MAX_LOCK_RETRIES, instanceName);
                    return true;
                }
                
                if (attempt < MAX_LOCK_RETRIES - 1) {
                    logger.debug("[LOCK RETRY] User: {}, Coupon: {}, Attempt: {}/{}, Retry in {}ms, Instance: {}", 
                        username, couponCode, attempt + 1, MAX_LOCK_RETRIES, delayMs, instanceName);
                    Thread.sleep(delayMs);
                    delayMs = Math.min(delayMs * 2, 1000); // Cap at 1 second
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                logger.error("[LOCK ERROR] User: {}, Coupon: {}, Instance: {}, Error: Lock acquisition interrupted", 
                    username, couponCode, instanceName, e);
                return false;
            }
        }
        
        logger.warn("[LOCK FAILED] User: {}, Coupon: {}, Failed after {}/{} attempts, Instance: {}", 
            username, couponCode, MAX_LOCK_RETRIES, MAX_LOCK_RETRIES, instanceName);
        return false;
    }

    @Transactional
    public RedeemResponse redeemCoupon(RedeemRequest request) {
        String lockKey = LOCK_KEY_PREFIX + request.couponCode();
        String lockValue = UUID.randomUUID().toString();

        try {
            // Acquire lock with exponential backoff retry
            boolean acquired = acquireLockWithRetry(lockKey, lockValue, request.couponCode(), request.username());
            if (!acquired) {
                logger.warn("[LOCK UNAVAILABLE] User: {}, Coupon: {}, Instance: {}, Reason: Max retries exceeded", 
                    request.username(), request.couponCode(), instanceName);
                return RedeemResponse.failure("Coupon is busy, please retry.", instanceName);
            }

            Coupon coupon = couponRepository.findByCode(request.couponCode())
                    .orElse(null);

            if (coupon == null) {
                logger.error("[COUPON NOT FOUND] User: {}, Coupon Code: {}, Instance: {}", 
                    request.username(), request.couponCode(), instanceName);
                return RedeemResponse.failure("Coupon Not Found", instanceName);
            }

            if (coupon.getRemainingRedemptions() <= 0) {
                redemptionRepository.save(
                        new CouponRedemption(coupon.getId(), request.username(), RedemptionStatus.FAILED));
                logger.warn("[COUPON EXHAUSTED] User: {}, Coupon: {}, Remaining: 0, Instance: {}", 
                    request.username(), request.couponCode(), instanceName);
                return RedeemResponse.failure("Coupon Exhausted", instanceName);
            }

            coupon.setRemainingRedemptions(coupon.getRemainingRedemptions() - 1);
            couponRepository.save(coupon);

            redemptionRepository.save(
                    new CouponRedemption(coupon.getId(), request.username(), RedemptionStatus.SUCCESS));

            logger.info("[COUPON REDEEMED] User: {}, Coupon: {}, Remaining: {}, Instance: {}", 
                request.username(), request.couponCode(), coupon.getRemainingRedemptions(), instanceName);

            return RedeemResponse.success("Coupon Redeemed", instanceName);

        } finally {
            lockStrategy.releaseLock(lockKey, lockValue);
            logger.debug("[LOCK RELEASED] User: {}, Coupon: {}, Instance: {}", 
                request.username(), request.couponCode(), instanceName);
        }
    }

    public Page<RedemptionResponse> getRedemptions(Long couponId, int page, int size) {
        Coupon coupon = couponRepository.findById(couponId)
                .orElseThrow(() -> new CouponNotFoundException(couponId));

        return redemptionRepository
                .findByCouponIdOrderByRedeemedAtDesc(couponId, PageRequest.of(page, size))
                .map(r -> RedemptionResponse.from(r, coupon.getCode()));
    }
}
