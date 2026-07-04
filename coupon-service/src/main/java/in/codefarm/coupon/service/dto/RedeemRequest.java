package in.codefarm.coupon.service.dto;

import jakarta.validation.constraints.NotBlank;

public record RedeemRequest(
        @NotBlank String couponCode,
        @NotBlank String username
) {
}
