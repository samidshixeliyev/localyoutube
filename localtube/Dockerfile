# LocalTube Backend Dockerfile
FROM eclipse-temurin:21-jdk as builder

WORKDIR /app
COPY . .
RUN chmod +x ./gradlew && ./gradlew bootJar -x test

FROM eclipse-temurin:21-jre

# Install FFmpeg
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/build/libs/*.jar app.jar

# Create directories
RUN mkdir -p /data/uploads /data/hls

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]