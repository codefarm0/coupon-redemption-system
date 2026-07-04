package in.codefarm.coupon.service.lock;

public interface LockStrategy {

    boolean acquireLock(String key, String value, long timeoutMs);

    void releaseLock(String key, String value);
}
