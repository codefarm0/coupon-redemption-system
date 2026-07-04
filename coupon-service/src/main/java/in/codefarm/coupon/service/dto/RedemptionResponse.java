package in.codefarm.coupon.service.dto;

import in.codefarm.coupon.service.entity.CouponRedemption;
import java.time.LocalDateTime;

public record RedemptionResponse(
        String username,
        String couponCode,
        String status,
        LocalDateTime redeemedAt
) {

    public static RedemptionResponse from(CouponRedemption redemption, String couponCode) {
        return new RedemptionResponse(
                redemption.getUsername(),
                couponCode,
                redemption.getStatus().name(),
                redemption.getRedeemedAt()
        );
    }
}
