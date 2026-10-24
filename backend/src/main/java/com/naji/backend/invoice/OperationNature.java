package com.naji.backend.invoice;

import com.naji.backend.product.ProductType;

import java.util.List;

/**
 * Nature of the operations of an invoice, a mandatory mention under the e-invoicing reform: deliveries of goods only,
 * provisions of services only, or both. Derived from the types of the lines.
 */
public enum OperationNature {
    GOODS,
    SERVICES,
    MIXED;

    /** {@code null} when there is no line yet. */
    public static OperationNature of(List<InvoiceLine> lines) {
        boolean goods = lines.stream().anyMatch(line -> line.getType() == ProductType.GOODS);
        boolean services = lines.stream().anyMatch(line -> line.getType() == ProductType.SERVICE);
        if (goods && services) {
            return MIXED;
        }
        if (goods) {
            return GOODS;
        }
        return services ? SERVICES : null;
    }
}
