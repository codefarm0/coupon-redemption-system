package in.codefarm.coupon.service.lock;

public class NoLockStrategy implements LockStrategy {

    @Override
    public boolean acquireLock(String key, String value, long timeoutMs) {
        return true;
    }

    @Override
    public void releaseLock(String key, String value) {
    }
}
