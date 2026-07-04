package in.codefarm.coupon.service.exception;

public class CouponAlreadyExistsException extends RuntimeException {

    public CouponAlreadyExistsException(String code) {
        super("Coupon already exists: " + code);
    }
}
