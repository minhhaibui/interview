# Bản hiện tại: skeleton chạy bằng Node core thuần, CHƯA có dependency
# → image chỉ cần copy src. Sau Upgrade 1-3 (đã npm install pg/redis/kafkajs)
# → đổi sang bản multi-stage trong UPGRADE-04-DOCKER-K8S.md để cache layer deps.
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY src ./src

# Không chạy bằng root — image node có sẵn user 'node' (câu hỏi security hay gặp)
USER node

EXPOSE 3000
CMD ["node", "src/server.js"]
