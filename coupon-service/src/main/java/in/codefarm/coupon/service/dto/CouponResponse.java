package in.codefarm.coupon.service.dto;

import in.codefarm.coupon.service.entity.Coupon;
import java.time.LocalDateTime;

public record CouponResponse(
        Long id,
        String code,
        Integer totalRedemptions,
        Integer remainingRedemptions,
        LocalDateTime createdAt
) {

    public static CouponResponse from(Coupon coupon) {
        return new CouponResponse(
                coupon.getId(),
                coupon.getCode(),
                coupon.getTotalRedemptions(),
                coupon.getRemainingRedemptions(),
                coupon.getCreatedAt()
        );
    }
}
