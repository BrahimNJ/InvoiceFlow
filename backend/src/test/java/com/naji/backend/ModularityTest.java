package com.naji.backend;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModule;
import org.springframework.modulith.core.ApplicationModules;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Spring Modulith reads the package structure: each direct sub-package of {@code com.naji.backend} is a module,
 * and its sub-packages are internal unless exposed ({@code common} is open, {@code user.dto} is a named interface).
 */
class ModularityTest {

    private static final ApplicationModules MODULES = ApplicationModules.of(BackendApplication.class);

    /** The block of docs/architecture.md that this test keeps in sync with the code. */
    private static final Path ARCHITECTURE_DOC = Path.of("..", "docs", "architecture.md");
    private static final String START = "<!-- modules:start";
    private static final String END = "<!-- modules:end -->";

    @Test
    void modulesOnlyUseEachOthersPublicApiAndHaveNoCycles() {
        MODULES.verify();
    }

    @Test
    void documentedModuleDiagramMatchesTheCode() throws IOException {
        String doc = Files.readString(ARCHITECTURE_DOC).replace("\r\n", "\n");
        int start = doc.indexOf(START);
        int end = doc.indexOf(END);
        assertThat(start).as("docs/architecture.md must contain the generated module block").isNotNegative();

        String documented = doc.substring(doc.indexOf('\n', start) + 1, end).strip();

        assertThat(documented)
                .as("The module diagram in docs/architecture.md is out of date; replace it with the expected block")
                .isEqualTo(moduleDiagram());
    }

    /** A Mermaid flowchart of the real module dependencies, sorted so that the output is stable. */
    static String moduleDiagram() {
        String edges = MODULES.stream()
                .sorted(Comparator.comparing(ApplicationModule::getIdentifier))
                .flatMap(module -> module.getDirectDependencies(MODULES).uniqueModules()
                        .filter(target -> !target.equals(module))
                        .sorted(Comparator.comparing(ApplicationModule::getIdentifier))
                        .map(target -> "    %s --> %s".formatted(module.getIdentifier(), target.getIdentifier())))
                .collect(Collectors.joining("\n"));
        return "```mermaid\nflowchart LR\n" + edges + "\n```";
    }
}
