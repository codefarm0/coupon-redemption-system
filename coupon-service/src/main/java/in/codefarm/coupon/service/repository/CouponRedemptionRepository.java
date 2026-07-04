package in.codefarm.coupon.service.repository;

import in.codefarm.coupon.service.entity.CouponRedemption;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CouponRedemptionRepository extends JpaRepository<CouponRedemption, Long> {

    Page<CouponRedemption> findByCouponIdOrderByRedeemedAtDesc(Long couponId, Pageable pageable);
}
