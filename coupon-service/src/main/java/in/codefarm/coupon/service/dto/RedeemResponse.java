package in.codefarm.coupon.service.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record RedeemResponse(
        boolean success,
        String message,
        String instanceName
) {

    public static RedeemResponse success(String message, String instanceName) {
        return new RedeemResponse(true, message, instanceName);
    }

    public static RedeemResponse failure(String message, String instanceName) {
        return new RedeemResponse(false, message, instanceName);
    }
}
