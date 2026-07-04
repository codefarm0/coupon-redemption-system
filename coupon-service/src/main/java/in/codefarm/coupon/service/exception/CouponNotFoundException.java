package in.codefarm.coupon.service.exception;

public class CouponNotFoundException extends RuntimeException {

    public CouponNotFoundException(String code) {
        super("Coupon not found: " + code);
    }

    public CouponNotFoundException(Long id) {
        super("Coupon not found: " + id);
    }
}
