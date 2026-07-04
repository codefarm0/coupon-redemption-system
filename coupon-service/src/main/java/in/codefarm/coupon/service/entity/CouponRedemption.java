package in.codefarm.coupon.service.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "coupon_redemptions")
public class CouponRedemption {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "coupon_id", nullable = false)
    private Long couponId;

    @Column(nullable = false, length = 100)
    private String username;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RedemptionStatus status;

    @Column(name = "redeemed_at", nullable = false, updatable = false)
    private LocalDateTime redeemedAt;

    public CouponRedemption() {
    }

    public CouponRedemption(Long couponId, String username, RedemptionStatus status) {
        this.couponId = couponId;
        this.username = username;
        this.status = status;
    }

    @PrePersist
    protected void onCreate() {
        this.redeemedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public Long getCouponId() {
        return couponId;
    }

    public String getUsername() {
        return username;
    }

    public RedemptionStatus getStatus() {
        return status;
    }

    public LocalDateTime getRedeemedAt() {
        return redeemedAt;
    }
}
