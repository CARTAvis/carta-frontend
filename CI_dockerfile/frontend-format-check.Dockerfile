# Image used by the format-check jobs in .github/workflows.
# Keep the prettier version in sync with package-lock.json.
#
# Build and push for both architectures (the runners are linux/amd64):
#   docker buildx build --platform linux/amd64,linux/arm64 \
#     -f CI_dockerfile/frontend-format-check.Dockerfile \
#     -t carta/frontend-format-check:latest --push CI_dockerfile
FROM node:26-bookworm-slim

RUN npm install --global prettier@3.9.10

WORKDIR /workspace
CMD ["prettier", "--check", "./src"]
