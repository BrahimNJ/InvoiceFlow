package com.naji.backend.invoice;

import com.naji.backend.company.Company;
import com.naji.backend.company.LegalForm;
import com.naji.backend.company.VatRegime;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * Seller details as printed on the invoice. Copied from the owner's company at the moment the invoice is issued and
 * never changed afterwards; {@code null} on a draft and on invoices issued before the company existed.
 */
@Embeddable
@Getter
@Setter
@NoArgsConstructor
public class InvoiceSeller {

    @Column(name = "seller_legal_name")
    private String legalName;

    @Column(name = "seller_trade_name")
    private String tradeName;

    @Enumerated(EnumType.STRING)
    @Column(name = "seller_legal_form", length = 10)
    private LegalForm legalForm;

    @Column(name = "seller_share_capital", precision = 14, scale = 2)
    private BigDecimal shareCapital;

    @Column(name = "seller_street")
    private String street;

    @Column(name = "seller_postal_code", length = 10)
    private String postalCode;

    @Column(name = "seller_city")
    private String city;

    @Column(name = "seller_country")
    private String country;

    @Column(name = "seller_siret", length = 14)
    private String siret;

    @Column(name = "seller_vat_number", length = 20)
    private String vatNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "seller_vat_regime", length = 10)
    private VatRegime vatRegime;

    @Column(name = "seller_registration", length = 120)
    private String registration;

    @Column(name = "seller_email")
    private String email;

    @Column(name = "seller_phone", length = 30)
    private String phone;

    @Column(name = "seller_iban", length = 34)
    private String iban;

    @Column(name = "seller_bic", length = 11)
    private String bic;

    /** A snapshot of the company's current details. */
    public static InvoiceSeller from(Company company) {
        InvoiceSeller seller = new InvoiceSeller();
        seller.setLegalName(company.getLegalName());
        seller.setTradeName(company.getTradeName());
        seller.setLegalForm(company.getLegalForm());
        seller.setShareCapital(company.getShareCapital());
        seller.setStreet(company.getStreet());
        seller.setPostalCode(company.getPostalCode());
        seller.setCity(company.getCity());
        seller.setCountry(company.getCountry());
        seller.setSiret(company.getSiret());
        seller.setVatNumber(company.getVatNumber());
        seller.setVatRegime(company.getVatRegime());
        seller.setRegistration(company.getRegistration());
        seller.setEmail(company.getEmail());
        seller.setPhone(company.getPhone());
        seller.setIban(company.getIban());
        seller.setBic(company.getBic());
        return seller;
    }

    /** The SIREN, i.e. the first nine digits of the SIRET; {@code null} without a full SIRET. */
    public String getSiren() {
        return siret == null || siret.length() != 14 ? null : siret.substring(0, 9);
    }
}
