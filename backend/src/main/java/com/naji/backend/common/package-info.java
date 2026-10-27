/**
 * Shared kernel: configuration, security, error handling, validation and web helpers used by every business module.
 * Declared open so that its sub-packages are usable everywhere; it must never depend on a business module.
 */
@ApplicationModule(displayName = "Common", type = ApplicationModule.Type.OPEN)
package com.naji.backend.common;

import org.springframework.modulith.ApplicationModule;
