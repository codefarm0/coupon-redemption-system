package in.codefarm.coupon.service.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

public record CreateCouponRequest(
        @NotBlank String code,
        @Min(1) int totalRedemptions
) {
}
