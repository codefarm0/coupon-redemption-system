package in.codefarm.coupon.service.controller;

import in.codefarm.coupon.service.dto.CouponResponse;
import in.codefarm.coupon.service.dto.CreateCouponRequest;
import in.codefarm.coupon.service.dto.RedeemRequest;
import in.codefarm.coupon.service.dto.RedeemResponse;
import in.codefarm.coupon.service.dto.RedemptionResponse;
import in.codefarm.coupon.service.service.CouponRedemptionService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/coupons")
public class CouponController {
    private final Logger logger = LoggerFactory.getLogger(CouponController.class);
    private final CouponRedemptionService couponService;

    public CouponController(CouponRedemptionService couponService) {
        this.couponService = couponService;
    }

    @PostMapping
    public ResponseEntity<CouponResponse> createCoupon(@RequestBody @Valid CreateCouponRequest request) {
        logger.info("creating coupon");
        CouponResponse response = couponService.createCoupon(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping
    public ResponseEntity<Page<CouponResponse>> getCoupons(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "5") int size
    ) {
        logger.info("fetching coupon");
        Page<CouponResponse> response = couponService.getCoupons(page, size);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/redeem")
    public ResponseEntity<RedeemResponse> redeemCoupon(@RequestBody @Valid RedeemRequest request) {
        logger.info("redeeming coupon");
        RedeemResponse response = couponService.redeemCoupon(request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{couponId}/redemptions")
    public ResponseEntity<Page<RedemptionResponse>> getRedemptions(
            @PathVariable Long couponId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "5") int size
    ) {
        Page<RedemptionResponse> response = couponService.getRedemptions(couponId, page, size);
        return ResponseEntity.ok(response);
    }
}
