package in.codefarm.coupon.service.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "coupons")
public class Coupon {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String code;

    @Column(name = "total_redemptions", nullable = false)
    private Integer totalRedemptions;

    @Column(name = "remaining_redemptions", nullable = false)
    private Integer remainingRedemptions;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    public Coupon() {
    }

    public Coupon(String code, Integer totalRedemptions) {
        this.code = code;
        this.totalRedemptions = totalRedemptions;
        this.remainingRedemptions = totalRedemptions;
    }

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public String getCode() {
        return code;
    }

    public Integer getTotalRedemptions() {
        return totalRedemptions;
    }

    public Integer getRemainingRedemptions() {
        return remainingRedemptions;
    }

    public void setRemainingRedemptions(Integer remainingRedemptions) {
        this.remainingRedemptions = remainingRedemptions;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }
}
