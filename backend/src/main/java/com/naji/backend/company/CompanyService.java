package com.naji.backend.company;

import com.naji.backend.common.exception.ConflictException;
import com.naji.backend.common.exception.ResourceNotFoundException;
import com.naji.backend.company.dto.CompanyRequest;
import com.naji.backend.company.dto.CompanyResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The signed-in user's company: each user reads and saves only their own, through their owner id. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CompanyService {

    static final String NOT_FOUND = "No company details recorded yet";

    private final CompanyRepository companyRepository;
    private final CompanyMapper companyMapper;

    /** The owner's company; 404 until it has been saved once. */
    public CompanyResponse find(Long ownerId) {
        return companyRepository.findByOwnerId(ownerId)
                .map(companyMapper::toResponse)
                .orElseThrow(() -> new ResourceNotFoundException(NOT_FOUND));
    }

    /**
     * Creates the owner's company on the first save, updates it afterwards. Two first saves at the same time hit the
     * one-company-per-owner constraint: the second one gets a 409 and can save again, which then updates.
     */
    @Transactional
    public CompanyResponse save(Long ownerId, CompanyRequest request) {
        Company company = companyRepository.findByOwnerId(ownerId).orElseGet(() -> {
            Company created = new Company();
            created.setOwnerId(ownerId);
            return created;
        });
        companyMapper.updateEntity(company, request);
        try {
            return companyMapper.toResponse(companyRepository.saveAndFlush(company));
        } catch (DataIntegrityViolationException e) {
            throw new ConflictException("Your company details were saved at the same time elsewhere: save again");
        }
    }
}
