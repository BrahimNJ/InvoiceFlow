package com.naji.backend.company.dto;

import com.naji.backend.common.validation.SiretValidator;
import com.naji.backend.company.VatNumbers;
import com.naji.backend.company.VatRegime;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public class ConsistentCompanyValidator implements ConstraintValidator<ConsistentCompany, CompanyRequest> {

    @Override
    public boolean isValid(CompanyRequest request, ConstraintValidatorContext context) {
        if (request == null) {
            return true;
        }
        context.disableDefaultConstraintViolation();
        boolean valid = true;

        if (request.legalForm() != null && request.legalForm().requiresShareCapital()
                && request.shareCapital() == null) {
            valid = violation(context, "shareCapital", "is required for this legal form");
        }

        String vatNumber = blankToNull(request.vatNumber());
        if (vatNumber == null) {
            if (request.vatRegime() == VatRegime.STANDARD) {
                valid = violation(context, "vatNumber", "is required under the standard VAT regime");
            }
        } else {
            String compact = VatNumbers.normalize(vatNumber);
            if (!VatNumbers.isWellFormed(compact)) {
                valid = violation(context, "vatNumber", "must be a VAT number such as FR44732829320");
            } else if (request.siret() != null && SiretValidator.isValid(request.siret())
                    && !VatNumbers.matchesSiren(compact, request.siret().substring(0, 9))) {
                valid = violation(context, "vatNumber", "does not match the SIREN of the SIRET");
            }
        }
        return valid;
    }

    private static boolean violation(ConstraintValidatorContext context, String field, String message) {
        context.buildConstraintViolationWithTemplate(message).addPropertyNode(field).addConstraintViolation();
        return false;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
