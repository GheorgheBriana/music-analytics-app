FROM eclipse-temurin:17-jdk-alpine

WORKDIR /app

COPY .mvn/ .mvn
COPY mvnw pom.xml ./

# Convert CRLF to LF in case the script was edited in Windows
RUN sed -i 's/\r$//' mvnw

# Make sure the wrapper is executable
RUN chmod +x mvnw

# Go offline to cache dependencies
RUN ./mvnw dependency:go-offline

# Copy the source code
COPY src ./src

# Build the app skipping tests for faster build
RUN ./mvnw clean package -DskipTests

# Run the jar file
CMD ["java", "-jar", "target/backend-0.0.1-SNAPSHOT.jar"]
