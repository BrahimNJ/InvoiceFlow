package com.naji.backend.product;

import com.naji.backend.product.dto.ProductRequest;
import com.naji.backend.product.dto.ProductResponse;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;

@Component
public class ProductMapper {

    public Product toEntity(ProductRequest request) {
        Product product = new Product();
        updateEntity(product, request);
        return product;
    }

    /** Amounts are stored with 2 decimals; the request is already validated to have at most 2. */
    public void updateEntity(Product product, ProductRequest request) {
        product.setType(request.type());
        product.setName(request.name());
        product.setDescription(request.description());
        product.setUnitPrice(twoDecimals(request.unitPrice()));
        product.setVatRate(twoDecimals(request.vatRate()));
        product.setUnit(request.unit());
    }

    public ProductResponse toResponse(Product product) {
        return new ProductResponse(
                product.getId(),
                product.getType(),
                product.getName(),
                product.getDescription(),
                product.getUnitPrice(),
                product.getVatRate(),
                product.getUnit(),
                product.getCreatedAt(),
                product.getUpdatedAt()
        );
    }

    private static BigDecimal twoDecimals(BigDecimal value) {
        return value.setScale(2, RoundingMode.UNNECESSARY);
    }
}
