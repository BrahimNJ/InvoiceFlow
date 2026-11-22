package com.naji.backend.company;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

/** The seller details of one user. Each user has at most one company. */
@Entity
@Table(name = "companies")
@Getter
@Setter
@NoArgsConstructor
public class Company {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Id of the user who owns this company (JWT subject). Unique: one company per user. */
    @Column(nullable = false, updatable = false, unique = true)
    private Long ownerId;

    @Column(nullable = false)
    private String legalName;

    private String tradeName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private LegalForm legalForm;

    @Column(precision = 14, scale = 2)
    private BigDecimal shareCapital;

    @Column(nullable = false)
    private String street;

    @Column(nullable = false, length = 10)
    private String postalCode;

    @Column(nullable = false)
    private String city;

    @Column(nullable = false)
    private String country;

    @Column(nullable = false, length = 14)
    private String siret;

    @Column(length = 20)
    private String vatNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private VatRegime vatRegime;

    /** Trade or crafts register entry, e.g. "RCS Paris" or "RM 75". */
    @Column(length = 120)
    private String registration;

    private String email;

    @Column(length = 30)
    private String phone;

    @Column(length = 34)
    private String iban;

    @Column(length = 11)
    private String bic;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    /** The SIREN, i.e. the first nine digits of the SIRET; {@code null} without a full SIRET. */
    public String getSiren() {
        return siret == null || siret.length() != 14 ? null : siret.substring(0, 9);
    }

    @PrePersist
    void onCreate() {
        createdAt = Instant.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}
