# syntax=docker/dockerfile:1

# --- Build stage: compile and package the Spring Boot jar ---
FROM eclipse-temurin:21-jdk AS build
WORKDIR /workspace

# Resolve dependencies first so this layer is cached when only sources change
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw --batch-mode dependency:go-offline

COPY src/ src/
# Tests already ran in Backend CI before any deployment is triggered
RUN ./mvnw --batch-mode package -DskipTests

# --- Runtime stage: JRE only, non-root user ---
FROM eclipse-temurin:21-jre
WORKDIR /app

RUN useradd --system --uid 1001 spring
USER spring

COPY --from=build /workspace/target/*.jar app.jar

ENV SPRING_PROFILES_ACTIVE=prod
EXPOSE 8080

ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
