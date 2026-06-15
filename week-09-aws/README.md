# Tuần 9: AWS

> 🌱 **Mới với chủ đề này?** Đọc [`CO-BAN.md`](CO-BAN.md) TRƯỚC — bài nhập môn cực dễ, giải thích bằng ví dụ đời thường, không thuật ngữ khó. Xong rồi quay lại đọc bài đầy đủ bên dưới.

> 🔬 **Có bản đào sâu!** Xem [`DEEP-DIVE.md`](DEEP-DIVE.md) — cơ chế bên trong, ví dụ nâng cao, bẫy production & câu hỏi phỏng vấn KHÓ hơn cho tuần này.

## 🎯 Mục tiêu tuần này

- Nắm vững các building blocks: IAM, VPC, EC2, S3, RDS, ElastiCache — giải thích được security group vs NACL, Multi-AZ vs read replica.
- Hiểu serverless stack (Lambda + API Gateway) với Node.js: cold start, limits, khi nào chọn serverless vs container.
- So sánh và chọn đúng messaging service: SQS vs SNS vs EventBridge vs Kafka (MSK); nắm FIFO, DLQ, visibility timeout.
- Chọn đúng compute cho container: ECS vs EKS vs Fargate; thiết kế được kiến trúc Node.js microservices production trên AWS.
- Thực hành được với LocalStack/AWS Free Tier: SDK v3 cho Node.js, presigned URL, SQS consumer, Lambda handler.

## 📚 Lý thuyết

### Ngày 1-2: IAM, VPC, EC2, S3

#### IAM (Identity and Access Management)

- **User**: identity cho người (long-term credentials: password, access keys). Hạn chế dùng access keys — ưu tiên SSO/Identity Center.
- **Group**: gom users để gán policy chung.
- **Role**: identity **được assume tạm thời** — không có credentials cố định. Dùng cho: EC2 instance profile, Lambda execution role, ECS task role, cross-account access. STS cấp temporary credentials tự xoay vòng.
- **Policy**: JSON document định nghĩa quyền (Effect/Action/Resource/Condition). Identity-based (gắn vào user/role) vs resource-based (gắn vào S3 bucket, SQS queue...).

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:GetObject", "s3:PutObject"],
    "Resource": "arn:aws:s3:::my-app-uploads/*",
    "Condition": { "StringEquals": { "s3:x-amz-server-side-encryption": "AES256" } }
  }]
}
```

Logic đánh giá: **explicit Deny > explicit Allow > implicit Deny** (mặc định từ chối tất cả).

**Best practices** (hay bị hỏi):
1. **Least privilege**: chỉ cấp đúng action + đúng resource ARN, tránh `Action: "*"`.
2. **Role thay vì access keys**: app trên EC2/ECS/Lambda lấy quyền qua role, SDK tự động lấy credentials từ instance metadata — không bao giờ hardcode keys trong code/env.
3. Bật **MFA**, không dùng root account cho công việc hàng ngày.
4. Audit bằng CloudTrail, IAM Access Analyzer.

```js
// SDK v3 trong Node.js — KHÔNG truyền accessKeyId/secretAccessKey,
// SDK tự resolve theo credential chain (env -> shared config -> IAM role)
import { S3Client } from '@aws-sdk/client-s3';
const s3 = new S3Client({ region: 'ap-southeast-1' });
```

#### VPC (Virtual Private Cloud)

VPC = mạng riêng ảo của bạn trong AWS (1 CIDR block, vd `10.0.0.0/16`), chia thành **subnets** theo AZ:

- **Public subnet**: route table có route `0.0.0.0/0 → Internet Gateway (IGW)`. Đặt: ALB, NAT gateway, bastion.
- **Private subnet**: không route trực tiếp ra internet. Đặt: app servers, ECS tasks, RDS, ElastiCache. Muốn gọi ra ngoài (pull image, call API bên thứ 3) → route qua **NAT Gateway** (đặt ở public subnet, một chiều outbound).

```
Internet ──► IGW ──► [Public subnet AZ-a: ALB, NAT-GW] ──► [Private subnet AZ-a: ECS tasks]
                     [Public subnet AZ-b: ALB, NAT-GW] ──► [Private subnet AZ-b: ECS tasks]
                                                            [Private subnet (data): RDS, Redis]
```

**Security Group vs NACL** — câu hỏi kinh điển:

| | Security Group | NACL |
|---|---|---|
| Cấp độ | ENI/instance | Subnet |
| Stateful? | **Stateful** (response tự cho qua) | **Stateless** (phải mở cả chiều về, ephemeral ports) |
| Rules | Chỉ Allow | Allow + Deny |
| Đánh giá | Tất cả rules | Theo số thứ tự, rule khớp đầu tiên thắng |
| Use case | Tường lửa chính cho app | Lớp phòng thủ phụ, block IP ở mức subnet |

Best practice: SG của app chỉ allow inbound từ **SG của ALB** (reference SG-to-SG thay vì CIDR); SG của RDS chỉ allow 5432 từ SG của app.

VPC Endpoints: cho phép private subnet gọi S3/DynamoDB (Gateway endpoint, free) hoặc các services khác (Interface endpoint) **không qua NAT** — tiết kiệm chi phí NAT data processing.

#### EC2

- **Instance types**: family theo workload — `t` (burstable, dev/test), `m` (general), `c` (compute-optimized), `r` (memory-optimized), `g/p` (GPU). Naming: `m7g.large` = family m, gen 7, Graviton (ARM), size large.
- **Pricing**: On-Demand, Reserved/Savings Plans (cam kết 1-3 năm, rẻ hơn ~40-70%), **Spot** (rẻ ~90% nhưng bị thu hồi với 2 phút báo trước — hợp cho workers stateless, batch).
- **Auto Scaling Group (ASG)**: duy trì min/desired/max instances qua nhiều AZ, thay instance unhealthy, scale theo policy (target tracking CPU 60%, schedule, step). Kết hợp Launch Template (AMI, instance type, user-data).
- **Load Balancer**:
  - **ALB** (Application LB, L7): route theo host/path/header, hỗ trợ WebSocket, HTTP/2, target weighted (canary), tích hợp WAF & Cognito. Mặc định cho HTTP APIs.
  - **NLB** (Network LB, L4): TCP/UDP, hiệu năng cực cao, static IP/Elastic IP, preserve source IP. Dùng cho TCP thuần, gRPC throughput cao, hoặc làm target của API Gateway VPC Link.
  - Health checks của target group quyết định instance nhận traffic — giống readiness của K8s.

#### S3

- Object storage, durability 11 số 9, scale vô hạn, bucket name global-unique. Consistency: **strong read-after-write** (từ 2020).
- **Storage classes**: Standard → Standard-IA (ít truy cập) → One Zone-IA → Glacier Instant/Flexible/Deep Archive (lưu trữ, rẻ dần, lấy ra chậm dần) → **Intelligent-Tiering** (tự chuyển tier, an toàn khi không đoán được access pattern).
- **Lifecycle policy**: tự động chuyển class/xóa: vd logs sau 30 ngày → IA, 90 ngày → Glacier, 365 ngày → expire.
- **Presigned URL**: cấp quyền tạm thời cho client upload/download trực tiếp với S3, không đi qua server → giảm tải backend.

```js
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({ region: 'ap-southeast-1' });

app.post('/uploads/presign', async (req, res) => {
  const key = `uploads/${crypto.randomUUID()}-${req.body.filename}`;
  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: 'my-app-uploads', Key: key, ContentType: req.body.contentType }),
    { expiresIn: 300 }   // URL sống 5 phút
  );
  res.json({ url, key });   // client PUT file trực tiếp lên url này
});
```

- **Static hosting**: bật website hosting hoặc (chuẩn hơn) S3 private + **CloudFront** với Origin Access Control — bucket không public, chỉ CloudFront đọc được.
- Security: Block Public Access mặc định bật, bucket policy, SSE-S3/SSE-KMS encryption, versioning chống xóa nhầm.

### Ngày 3-4: RDS, ElastiCache, Lambda, API Gateway, SQS/SNS/EventBridge

#### RDS

- Managed relational DB (Postgres, MySQL...): AWS lo patching, backup, failover. Aurora là bản cloud-native (storage tách compute, replica lag ~ms, autoscaling storage).
- **Multi-AZ vs Read Replica** — câu hỏi kinh điển:

| | Multi-AZ | Read Replica |
|---|---|---|
| Mục đích | **High availability** (HA) | **Read scaling** |
| Replication | Synchronous | Asynchronous (có lag) |
| Standby nhận traffic? | Không (chỉ chờ failover) | Có (read-only queries) |
| Failover | Tự động (~60-120s, DNS switch) | Phải promote thủ công |
| Cross-region? | Không (cùng region, khác AZ) | Được |

Production chuẩn: **Multi-AZ cho HA + read replicas cho scale đọc** (report, analytics). App Node.js trỏ writes vào writer endpoint, reads nặng vào reader endpoint.

- **Backup**: automated backup (point-in-time recovery, retention tối đa 35 ngày) + manual snapshots (giữ vô hạn). 
- Node.js lưu ý: serverless/container scale nhiều instance → cạn `max_connections` → dùng **RDS Proxy** (connection pooling managed) hoặc pool nhỏ mỗi instance (pg Pool max 5-10).

#### ElastiCache

- Managed **Redis** (phổ biến) hoặc Memcached. Use cases: cache (cache-aside), session store, rate limiting, leaderboard, pub/sub nhẹ.
- Redis cluster mode: sharding qua nhiều node; replication group có primary + replicas, Multi-AZ auto-failover.
- Memcached khi: cache thuần đơn giản, multi-thread, không cần persistence/data structures.

```js
// Cache-aside pattern điển hình
async function getUser(id) {
  const cached = await redis.get(`user:${id}`);
  if (cached) return JSON.parse(cached);
  const user = await db.query('SELECT * FROM users WHERE id=$1', [id]);
  await redis.set(`user:${id}`, JSON.stringify(user), 'EX', 300); // TTL 5 phút
  return user;
}
```

#### Lambda

Function-as-a-Service: chỉ viết handler, AWS lo provisioning/scaling, trả tiền theo invocation + GB-second.

```js
// handler.mjs — Lambda Node.js 20.x
export const handler = async (event) => {
  // event từ API Gateway (proxy integration)
  const body = JSON.parse(event.body ?? '{}');
  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ok: true, received: body }),
  };
};
```

- **Cold start**: lần đầu (hoặc scale ra môi trường mới) Lambda phải tạo sandbox + load runtime + chạy init code → trễ thêm ~100ms–vài giây. Giảm bằng: bundle nhỏ (esbuild, tree-shaking), ít deps, **khởi tạo connection/SDK client NGOÀI handler** (tái dùng giữa các invocation ấm), tăng memory (CPU tỷ lệ theo memory), Provisioned Concurrency (giữ sẵn N môi trường ấm — tốn tiền), tránh VPC nếu không cần (đã cải thiện nhiều với Hyperplane ENI).
- **Limits cần nhớ**: timeout tối đa **15 phút**; memory 128MB–10GB; payload sync **6MB**; deployment package 250MB unzipped (container image tới 10GB); /tmp 512MB–10GB; concurrency mặc định 1000/region (soft limit).
- **Khi nào serverless vs container**:
  - Lambda: traffic spiky/không đều, event-driven (S3 trigger, SQS, cron), scale-to-zero, team nhỏ không muốn quản hạ tầng.
  - Container (ECS/EKS): traffic đều và cao (Lambda đắt hơn khi chạy liên tục), request > 15 phút, WebSocket/long-lived connections, cần kiểm soát runtime/network tinh vi, tránh cold start hoàn toàn.

#### API Gateway

- Managed API frontdoor: routing, **authentication** (Cognito, Lambda authorizer, IAM), **throttling/rate limiting**, API keys & usage plans, request validation, caching.
- **REST API** (nhiều tính năng, đắt hơn) vs **HTTP API** (rẻ ~70%, nhanh hơn, đủ dùng cho đa số case) vs **WebSocket API**.
- Tích hợp: Lambda proxy, HTTP backend, hoặc private ALB qua VPC Link. Timeout tích hợp 29s (mặc định) — long task phải chuyển async (SQS + worker).

#### SQS vs SNS vs EventBridge (và so với Kafka)

- **SQS** (queue, point-to-point): producer gửi vào queue, **một** consumer group kéo về xử lý rồi xóa message. Pull model, scale consumer thoải mái.
  - **Visibility timeout**: khi consumer nhận message, message bị "ẩn" trong N giây; nếu không delete kịp (xử lý xong), message **hiện lại** cho consumer khác → at-least-once, cần **idempotent consumer**. Đặt visibility timeout ≥ 6× thời gian xử lý (khuyến nghị AWS) hoặc ít nhất > max processing time.
  - **DLQ** (dead-letter queue): sau `maxReceiveCount` lần xử lý fail, message chuyển sang DLQ để điều tra — tránh poison message lặp vô hạn.
  - **Standard** (throughput không giới hạn, at-least-once, best-effort ordering) vs **FIFO** (ordering chặt theo MessageGroupId, exactly-once nhờ deduplication, throughput 300 msg/s hoặc 3000 với batching).
- **SNS** (pub/sub, fan-out): publisher gửi topic, **nhiều** subscribers nhận (SQS, Lambda, email, HTTP). Push model, không lưu trữ lâu — subscriber offline là mất (vì vậy pattern chuẩn: **SNS → SQS fan-out** để mỗi service có queue riêng, durable).
- **EventBridge** (event bus): pub/sub + **content-based routing** bằng rules trên nội dung JSON event, schema registry, tích hợp 200+ AWS services & SaaS partners, archive/replay. Chậm hơn SNS một chút, throughput thấp hơn. Là lựa chọn mặc định cho **event-driven architecture giữa các services/domains**.
- **So với Kafka (MSK)**: Kafka là **log-based** — message lưu theo retention, nhiều consumer groups đọc độc lập với offset riêng, **replay** được, ordering theo partition, throughput cực cao. SQS xóa message sau khi xử lý, không replay. Chọn Kafka khi: event sourcing, stream processing, replay, throughput rất lớn, nhiều consumers khác nhau đọc cùng stream. Chọn SQS/SNS/EventBridge khi: muốn zero-ops, scale tự động, pay-per-use, pattern queue/fan-out đơn giản.

```js
// SQS consumer chuẩn trong Node.js (long polling + idempotent + DLQ via redrive policy)
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from '@aws-sdk/client-sqs';
const sqs = new SQSClient({});
const QueueUrl = process.env.QUEUE_URL;

while (running) {
  const { Messages = [] } = await sqs.send(new ReceiveMessageCommand({
    QueueUrl,
    MaxNumberOfMessages: 10,
    WaitTimeSeconds: 20,          // long polling: giảm empty receives, giảm cost
    VisibilityTimeout: 60,
  }));
  for (const msg of Messages) {
    try {
      await processIdempotently(JSON.parse(msg.Body));  // check processed_ids trước khi xử lý
      await sqs.send(new DeleteMessageCommand({ QueueUrl, ReceiptHandle: msg.ReceiptHandle }));
    } catch (e) {
      console.error('processing failed, message sẽ hiện lại sau visibility timeout', e);
      // không delete → retry; quá maxReceiveCount → tự sang DLQ
    }
  }
}
```

### Ngày 5-6: ECS/EKS/Fargate, CloudWatch, Route 53, CloudFront, Secrets, Cost & Well-Architected, kiến trúc mẫu

#### ECS vs EKS vs Fargate

- **ECS**: container orchestrator của riêng AWS — đơn giản, tích hợp sâu (ALB, IAM task role, CloudWatch), không phí control plane. Khái niệm: Task Definition (≈ pod spec), Service (≈ deployment), Cluster.
- **EKS**: managed **Kubernetes** control plane (~$73/tháng/cluster). Chọn khi: team đã biết K8s, cần hệ sinh thái K8s (Helm, operators, ArgoCD), multi-cloud/tránh lock-in.
- **Fargate**: **launch type** serverless cho cả ECS và EKS — không quản EC2, trả theo vCPU/RAM của task. Đắt hơn EC2 per-unit nhưng zero node management. Hạn chế: không DaemonSet, không GPU (giới hạn), không privileged.
- Rule-of-thumb: team nhỏ + muốn nhanh → **ECS Fargate**; tổ chức lớn đã đầu tư K8s → **EKS**; cost-sensitive + workload đều → ECS/EKS trên EC2 (kết hợp Spot).

#### CloudWatch

- **Logs**: log groups/streams; ECS/Lambda tự gửi stdout vào. **Logs Insights** query: 
  ```
  fields @timestamp, @message
  | filter level = "error"
  | stats count() by bin(5m)
  ```
  Node.js: log **JSON có cấu trúc** ra stdout (pino) để query được theo field.
- **Metrics**: built-in (CPU, memory...) + custom metrics (đắt — cân nhắc **EMF**: Embedded Metric Format, log JSON đặc biệt tự thành metric, rẻ hơn PutMetricData).
- **Alarms**: metric vượt threshold N datapoints → action (SNS notify, ASG scale, EC2 recover). Composite alarms gộp nhiều điều kiện giảm noise. Alarm quan trọng cho API: p99 latency, 5xx rate, DLQ depth > 0, RDS CPU/connections, Lambda errors/throttles.

#### Route 53

- Managed DNS. **Routing policies**: simple, weighted (canary 10% sang version mới), latency-based (user vào region gần nhất), **failover** (health check fail → trỏ sang DR site), geolocation.
- **Alias record**: như A record nhưng trỏ tới AWS resources (ALB, CloudFront) — free query, hỗ trợ zone apex (example.com), tự cập nhật IP.

#### CloudFront / CDN

- CDN: cache content tại 400+ edge locations → giảm latency, giảm tải origin. Origin: S3 (với **Origin Access Control** — bucket private), ALB, bất kỳ HTTP server.
- Pattern phổ biến: `CloudFront → (path /api/* → ALB) + (path /* → S3 static)` — một domain cho cả SPA + API, kèm WAF, TLS (ACM cert), HTTP/3.
- Cache theo cache policy (TTL, headers/query/cookies trong cache key); invalidation khi deploy (`/index.html`); signed URLs/cookies cho private content.

#### Secrets management: Secrets Manager vs Parameter Store

| | Secrets Manager | SSM Parameter Store |
|---|---|---|
| Giá | ~$0.40/secret/tháng + API calls | Standard tier **free** |
| Auto rotation | Có (built-in cho RDS, custom Lambda) | Không (tự làm) |
| Cross-account | Có | Hạn chế |
| Dùng cho | DB credentials, API keys cần rotation | Config, feature flags, secrets đơn giản (SecureString + KMS) |

ECS/Lambda inject secret lúc start qua `secrets` trong task definition / Lambda extension — app đọc từ `process.env`, không gọi API mỗi request (nếu gọi runtime thì cache lại).

#### Chi phí & Well-Architected Framework

**6 pillars**: Operational Excellence, **Security** (least privilege, encrypt at rest/in transit), **Reliability** (multi-AZ, auto scaling, backup, DR), Performance Efficiency, **Cost Optimization**, Sustainability.

Cost nhanh-phải-nhớ: NAT Gateway data processing (~$0.045/GB — dùng VPC endpoints cho S3/ECR); cross-AZ data transfer; CloudWatch logs ingest; Lambda chạy liên tục đắt hơn container; Savings Plans cho baseline + Spot cho workers; S3 lifecycle xuống IA/Glacier; right-sizing qua Cost Explorer + Compute Optimizer; đặt **Budget alerts** ngay ngày đầu.

#### Kiến trúc mẫu: Node.js microservices production trên AWS

```
                        Route 53 (alias) ──► CloudFront (+WAF, ACM TLS)
                                              │ /*            │ /api/*
                                              ▼               ▼
                                        S3 (SPA static)   ALB (public subnets, multi-AZ)
                                                              │
                              ┌───────────────────────────────┼──────────────────┐
                              ▼ (target group /api/users)     ▼ /api/orders      ▼ /api/payments
                        ECS Fargate Service A           ECS Service B      ECS Service C
                        (private subnets, ASG 3-10 tasks, task role least-privilege)
                              │                   │                  │
        ┌─────────────────────┼───────────────────┼──────────────────┤
        ▼                     ▼                   ▼                  ▼
  RDS Postgres          ElastiCache Redis    SQS (orders-queue   EventBridge bus
  (Multi-AZ + read      (cache, session,      + DLQ) ◄── worker   (domain events
   replica, RDS Proxy)   rate limit)          service (Fargate)    giữa services)
                                                                        │
  Secrets Manager (DB creds, rotation) ── inject vào task def           ▼
  CloudWatch (JSON logs, EMF metrics, alarms ► SNS ► Slack)      Lambda (side-effects:
  ECR (images, scan on push)  ─ CI/CD: GitHub Actions ► ECR ► ECS rolling deploy
```

Các quyết định thiết kế cần giải thích được trong phỏng vấn:
1. App tasks ở **private subnets**, chỉ ALB public; SG chain: ALB-SG → App-SG → RDS-SG.
2. Giao tiếp sync qua ALB/internal ALB hoặc service connect; **async qua SQS/EventBridge** để decouple — service down không kéo sập service khác.
3. RDS Multi-AZ cho HA, read replica cho reporting; RDS Proxy vì Fargate tasks scale làm bùng nổ connections.
4. Mỗi service một IAM task role riêng, least privilege; secrets từ Secrets Manager, không có trong image/env tĩnh.
5. Stateless tasks → scale ngang bằng target tracking (CPU/RequestCountPerTarget); session ra Redis.
6. Observability: structured logs (pino) → CloudWatch, metrics EMF, X-Ray/OTel tracing, alarms p99 + 5xx + DLQ depth.

## 💬 Top 15 câu hỏi phỏng vấn thường gặp

**Q1: IAM role khác IAM user thế nào? Tại sao app trên EC2/ECS nên dùng role?**
**A:** User có credentials cố định (password/access keys) dành cho người; role không có credentials cố định mà được assume để nhận temporary credentials qua STS, tự xoay vòng. App trên EC2/ECS/Lambda gắn role thì SDK tự lấy credentials từ metadata — không phải hardcode access keys trong code/env, hết rủi ro leak key và không phải rotate thủ công.

**Q2: Security Group khác NACL thế nào?**
**A:** SG hoạt động ở mức instance/ENI, stateful (response tự động được cho qua), chỉ có Allow rules, đánh giá tất cả rules. NACL ở mức subnet, stateless (phải mở cả inbound lẫn outbound kể cả ephemeral ports), có cả Allow và Deny, đánh giá theo thứ tự số. Thực tế SG là tường lửa chính; NACL dùng làm lớp phụ như block dải IP xấu.

**Q3: Public subnet khác private subnet ở điểm gì? NAT Gateway để làm gì?**
**A:** Khác nhau ở route table: public subnet có route 0.0.0.0/0 trỏ Internet Gateway, private thì không. App/DB đặt ở private subnet để không bị truy cập trực tiếp từ internet; khi cần gọi ra ngoài (pull image, gọi API bên thứ ba) thì route qua NAT Gateway đặt ở public subnet — NAT chỉ cho chiều outbound, và tính phí theo GB nên nên dùng VPC endpoints cho S3/ECR để giảm chi phí.

**Q4: RDS Multi-AZ khác Read Replica thế nào?**
**A:** Multi-AZ phục vụ high availability: standby được replicate đồng bộ ở AZ khác, không nhận traffic, tự động failover ~1-2 phút qua DNS. Read replica phục vụ scale đọc: replicate bất đồng bộ (có lag), nhận read queries, có thể cross-region, muốn thành primary phải promote thủ công. Production chuẩn dùng cả hai: Multi-AZ cho HA, replica cho reporting/read-heavy.

**Q5: Presigned URL là gì, dùng khi nào?**
**A:** URL được ký bằng credentials của server, cho phép client thực hiện đúng một thao tác (GET/PUT) trên đúng một object trong thời gian giới hạn. Dùng cho upload/download file trực tiếp giữa client và S3, không đi qua backend — giảm tải băng thông và CPU của server Node.js, server chỉ làm nhiệm vụ authorize và cấp URL.

**Q6: Cold start trong Lambda là gì, giảm thế nào với Node.js?**
**A:** Cold start là độ trễ khi Lambda phải tạo sandbox mới: load runtime + chạy init code, thêm ~100ms tới vài giây. Giảm bằng: bundle nhỏ với esbuild, khởi tạo SDK clients và DB connections ngoài handler để tái dùng khi warm, tăng memory (CPU tăng theo), Provisioned Concurrency cho path latency-sensitive, và cân nhắc bỏ VPC nếu không cần truy cập tài nguyên private.

**Q7: Khi nào chọn Lambda, khi nào chọn container (ECS/EKS)?**
**A:** Lambda hợp với traffic spiky/event-driven, cần scale-to-zero, task ngắn dưới 15 phút, team muốn zero-ops. Container hợp khi traffic đều và cao (chạy liên tục thì container rẻ hơn), cần WebSocket/long-lived connections, job dài, kiểm soát runtime/network sâu, hoặc tránh cold start. Nhiều hệ thống dùng cả hai: API chính trên ECS, side-effects và cron trên Lambda.

**Q8: SQS, SNS, EventBridge khác nhau thế nào?**
**A:** SQS là queue point-to-point: một nhóm consumer kéo message về xử lý rồi xóa, có DLQ và visibility timeout. SNS là pub/sub push fan-out tới nhiều subscribers nhưng không lưu trữ — pattern chuẩn là SNS fan-out vào nhiều SQS queues. EventBridge là event bus với content-based routing theo nội dung event, schema registry, archive/replay, tích hợp SaaS — lựa chọn mặc định cho event-driven architecture giữa các domain services.

**Q9: Visibility timeout trong SQS là gì? Liên quan gì tới idempotency?**
**A:** Khi consumer nhận message, message bị ẩn khỏi queue trong visibility timeout; nếu consumer không delete kịp (crash hoặc xử lý chậm), message hiện lại và được giao cho consumer khác. Vì vậy SQS là at-least-once delivery — message có thể được xử lý 2 lần, nên consumer phải idempotent (check processed ID, upsert thay vì insert). Timeout nên đặt lớn hơn hẳn thời gian xử lý tối đa.

**Q10: DLQ là gì, tại sao bắt buộc phải có?**
**A:** Dead-letter queue nhận message đã fail quá maxReceiveCount lần xử lý. Không có DLQ, một poison message (data lỗi làm consumer crash) sẽ retry vô hạn, chiếm tài nguyên và che lấp messages khác. Có DLQ thì message lỗi được cách ly để điều tra, kèm CloudWatch alarm khi DLQ depth > 0; sau khi fix bug có thể redrive về queue chính.

**Q11: Khi nào dùng Kafka (MSK) thay vì SQS?**
**A:** Kafka là log-based: message lưu theo retention, nhiều consumer groups đọc độc lập với offset riêng và replay được, ordering theo partition, throughput rất cao — hợp cho event sourcing, stream processing, nhiều team cùng tiêu thụ một stream. SQS xóa message sau xử lý, không replay, nhưng zero-ops và scale tự động. Nếu chỉ cần work queue hoặc fan-out đơn giản thì SQS/SNS rẻ và đơn giản hơn nhiều.

**Q12: ECS vs EKS vs Fargate — phân biệt và chọn thế nào?**
**A:** ECS là orchestrator riêng của AWS, đơn giản, không phí control plane; EKS là managed Kubernetes, hợp khi team đã có kỹ năng K8s và cần hệ sinh thái Helm/operators hoặc multi-cloud. Fargate không phải orchestrator mà là launch type serverless cho cả hai — không quản EC2 nodes, trả theo vCPU/RAM của task. Team nhỏ muốn nhanh: ECS Fargate; tổ chức chuẩn hóa K8s: EKS; tối ưu chi phí workload đều: chạy trên EC2 + Spot.

**Q13: ALB khác NLB thế nào?**
**A:** ALB là L7: route theo host/path/header, WebSocket, tích hợp WAF/Cognito, phù hợp HTTP APIs và microservices routing. NLB là L4 TCP/UDP: hiệu năng và throughput cực cao, latency thấp, static IP per AZ, preserve source IP — dùng cho TCP thuần, hoặc làm target VPC Link của API Gateway. Mặc định cho REST API Node.js là ALB.

**Q14: Secrets Manager vs Parameter Store — chọn cái nào?**
**A:** Secrets Manager có automatic rotation (built-in với RDS), cross-account, nhưng tốn ~$0.40/secret/tháng. Parameter Store standard tier miễn phí, có SecureString mã hóa KMS nhưng không tự rotation. Quy tắc thực dụng: DB credentials và API keys cần rotation → Secrets Manager; config và secrets tĩnh đơn giản → Parameter Store. Cả hai đều inject được vào ECS task definition/Lambda lúc khởi động.

**Q15: Thiết kế hệ thống Node.js API chịu được 1 AZ sập — những gì cần multi-AZ?**
**A:** ALB span ít nhất 2 public subnets ở 2 AZ; ECS service đặt tasks trải đều private subnets 2-3 AZ (spread placement); RDS Multi-AZ để tự failover; ElastiCache replication group với replica ở AZ khác và auto-failover; NAT Gateway mỗi AZ một cái (tránh cross-AZ dependency). SQS/S3/Lambda vốn đã multi-AZ sẵn. Kèm health checks và auto scaling để thay thế capacity mất đi.

## 💪 Bài tập thực hành (bắt buộc)

> Môi trường: dùng **LocalStack** (`docker run -d -p 4566:4566 localstack/localstack`) + `awslocal` CLI (hoặc `aws --endpoint-url=http://localhost:4566`) cho S3/SQS/SNS/Lambda/Secrets Manager — không cần AWS account. SDK v3 trong Node.js trỏ endpoint LocalStack:
> ```js
> const s3 = new S3Client({ region: 'us-east-1', endpoint: 'http://localhost:4566', forcePathStyle: true });
> ```
> Bài nào cần ALB/RDS thật thì làm bằng diagram + manifest/Terraform (không bắt buộc chạy).

### Bài 1: S3 presigned URL upload service
**Đề bài:** Tạo bucket `uploads` trên LocalStack. Viết Express service: `POST /uploads/presign` trả presigned PUT URL (TTL 5 phút, validate contentType chỉ cho image/*), `GET /files/:key` trả presigned GET URL. Viết script client upload 1 file ảnh bằng presigned URL (fetch PUT).
**Yêu cầu output:** Upload thành công không đi qua server (server log không có request PUT file); `awslocal s3 ls s3://uploads/uploads/` thấy object; presigned URL hết hạn sau 5 phút trả 403 (test bằng cách đợi hoặc đặt TTL 5s); request contentType `application/x-sh` bị từ chối 400.
**Gợi ý:** `@aws-sdk/s3-request-presigner`; nhớ `forcePathStyle: true` với LocalStack.

### Bài 2: SQS worker với DLQ và idempotency
**Đề bài:** Tạo queue `orders` + DLQ `orders-dlq` (redrive policy maxReceiveCount=3, visibility timeout 10s). Viết producer (POST /orders đẩy message) và worker riêng (long polling, xử lý "gửi email" giả lập 2s). Message có `orderId`; worker phải idempotent (lưu processed orderId vào Redis/Map). Gửi kèm 1 "poison message" (JSON lỗi khiến worker throw).
**Yêu cầu output:** 20 orders được xử lý đúng 20 lần dù gửi trùng 5 message (chứng minh idempotency bằng log); poison message sau đúng 3 lần receive xuất hiện trong DLQ (`awslocal sqs receive-message` trên DLQ); worker dùng long polling WaitTimeSeconds=20 (không busy-loop).
**Gợi ý:** `aws sqs set-queue-attributes` với RedrivePolicy JSON; đừng delete message khi xử lý fail.

### Bài 3: SNS fan-out + EventBridge routing
**Đề bài:** Topic SNS `order-events` fan-out vào 2 queues: `email-queue` và `analytics-queue` (2 worker riêng). Sau đó làm phiên bản EventBridge: bus `app-bus`, rule 1 match `detail-type = OrderCreated` với `detail.amount > 1000` → queue `vip-queue`, rule 2 match mọi OrderCreated → `analytics-queue`. So sánh 2 cách bằng 5-10 dòng nhận xét.
**Yêu cầu output:** Publish 1 message SNS → cả 2 queues đều nhận (cùng nội dung); với EventBridge: order amount 1500 vào cả vip-queue lẫn analytics-queue, order amount 100 chỉ vào analytics-queue; file nhận xét nêu được ít nhất: SNS đơn giản/nhanh, EventBridge lọc theo nội dung + nhiều integration.
**Gợi ý:** SNS subscription cần policy cho phép SNS gửi vào SQS (LocalStack dễ tính hơn nhưng nên viết đúng); EventBridge rule dùng event pattern với `"detail": {"amount": [{"numeric": [">", 1000]}]}`.

### Bài 4: Lambda + API Gateway trên LocalStack
**Đề bài:** Viết Lambda Node.js 20 `createUser`: validate body, ghi vào DynamoDB table `users` (LocalStack), publish event `UserCreated` lên EventBridge. Deploy bằng `awslocal lambda create-function` (zip bằng esbuild bundle) và nối với API Gateway (HTTP API) route `POST /users`. Khởi tạo DynamoDB client NGOÀI handler. Đo và so sánh thời gian cold invoke vs warm invoke.
**Yêu cầu output:** `curl POST http://localhost:4566/.../users` trả 201 và item xuất hiện trong DynamoDB (`awslocal dynamodb scan`); bundle zip < 1MB (chứng minh esbuild hiệu quả so với zip cả node_modules); bảng so sánh ít nhất 5 lần đo: lần đầu (cold) chậm hơn rõ rệt các lần sau (warm); event UserCreated bắt được ở một queue test.
**Gợi ý:** `esbuild handler.ts --bundle --platform=node --target=node20 --outfile=dist/index.js`; LocalStack URL dạng `http://localhost:4566/restapis/<id>/.../users` hoặc dùng `awslocal apigatewayv2`.

### Bài 5: Thiết kế kiến trúc production (design exercise)
**Đề bài:** Thiết kế trên giấy (diagram + 1-2 trang giải thích) hệ thống e-commerce Node.js: 3 services (users, orders, notifications), 5k RPS peak, yêu cầu chịu được 1 AZ sập, RTO < 5 phút, có file upload, có job gửi email async, budget-conscious. Phải chọn và biện luận: compute (ECS/EKS/Lambda?), DB + caching, messaging, secrets, CDN, observability, CI/CD. Kèm bảng ước lượng 5 dòng chi phí lớn nhất và 3 biện pháp giảm.
**Yêu cầu output:** Diagram đầy đủ (VPC, subnets, AZ, SG chain); mỗi lựa chọn công nghệ có ít nhất 1 câu "vì sao" và 1 câu "trade-off"; chỉ ra đúng ít nhất 3 single-point-of-failure đã được loại bỏ; phần cost nêu được NAT data processing và cách giảm (VPC endpoints).
**Gợi ý:** Bám theo kiến trúc mẫu ở phần lý thuyết, nhưng phải tự điều chỉnh theo yêu cầu đề (vd 5k RPS → bao nhiêu tasks? RDS instance class nào? có cần Kafka không hay SQS đủ?).

## 📝 Bài test cuối tuần

### Phần 1: Quiz 15 câu trắc nghiệm

**Câu 1:** App Node.js chạy trên ECS cần đọc S3. Cách cấp quyền ĐÚNG nhất?
A. Hardcode access keys trong env  B. Gắn IAM task role với policy s3:GetObject trên đúng bucket  C. Dùng root account keys  D. Mở bucket public

**Câu 2:** Trong IAM policy evaluation, thứ tự ưu tiên đúng là:
A. Allow > Deny  B. Explicit Deny > Explicit Allow > Implicit Deny  C. Theo thứ tự viết trong policy  D. Policy mới nhất thắng

**Câu 3:** Security Group là:
A. Stateless, mức subnet  B. Stateful, mức instance/ENI, chỉ Allow rules  C. Stateful, mức subnet  D. Stateless, có Deny rules

**Câu 4:** RDS Multi-AZ standby có nhận read traffic không?
A. Có, tự động load balance  B. Không — chỉ chờ failover; muốn scale đọc dùng read replica  C. Có nếu bật reader endpoint  D. Chỉ nhận write

**Câu 5:** ECS task trong private subnet cần pull image từ ECR và gọi API bên ngoài. Cần gì?
A. Internet Gateway gắn vào private subnet  B. NAT Gateway (hoặc VPC endpoints cho ECR/S3) trong route  C. Elastic IP cho task  D. Không cần gì

**Câu 6:** Lambda timeout tối đa là:
A. 30 giây  B. 5 phút  C. 15 phút  D. 1 giờ

**Câu 7:** Cách hiệu quả để tái dùng DB connection giữa các Lambda invocations?
A. Tạo connection trong handler  B. Khởi tạo connection ngoài handler (module scope)  C. Dùng global variable trong handler  D. Không thể tái dùng

**Câu 8:** SQS message được nhận nhưng consumer crash trước khi delete. Chuyện gì xảy ra?
A. Message mất vĩnh viễn  B. Message hiện lại sau visibility timeout và được giao lại  C. Message tự vào DLQ ngay  D. Queue bị block

**Câu 9:** Pattern chuẩn để 3 services cùng nhận một event một cách durable?
A. 3 services cùng poll 1 SQS queue  B. SNS topic fan-out vào 3 SQS queues riêng  C. Gọi HTTP lần lượt 3 services  D. Dùng 1 Lambda gọi 3 services

**Câu 10:** Điểm khác biệt CỐT LÕI của Kafka so với SQS?
A. Kafka rẻ hơn  B. Kafka là log-based: message giữ theo retention, nhiều consumer groups đọc độc lập và replay được  C. Kafka không cần consumer  D. SQS nhanh hơn mọi trường hợp

**Câu 11:** SQS FIFO queue đảm bảo ordering trong phạm vi nào?
A. Toàn queue luôn luôn  B. Trong cùng MessageGroupId  C. Trong cùng consumer  D. Không đảm bảo gì

**Câu 12:** Fargate là gì?
A. Một orchestrator thay thế ECS  B. Launch type serverless cho ECS/EKS — không quản lý EC2 nodes  C. Dịch vụ CDN  D. Bản nâng cấp của Lambda

**Câu 13:** Muốn serve SPA tĩnh + API cùng domain, chuẩn nhất là:
A. EC2 chạy nginx serve cả hai  B. CloudFront: /* → S3 (OAC, bucket private), /api/* → ALB  C. S3 website hosting public + CORS  D. API Gateway serve file tĩnh

**Câu 14:** DB credentials cần auto-rotation định kỳ. Chọn dịch vụ nào?
A. SSM Parameter Store  B. Secrets Manager  C. S3 bucket mã hóa  D. DynamoDB

**Câu 15:** Chi phí "ẩn" hay gây bất ngờ nhất trong kiến trúc VPC chuẩn?
A. Route 53 hosted zone  B. NAT Gateway data processing per GB  C. Security Groups  D. IAM roles

<details><summary>Đáp án</summary>

1. **B** — Task role + least privilege; SDK tự lấy temporary credentials, không hardcode.
2. **B** — Explicit Deny luôn thắng; không có Allow nào thì mặc định Deny.
3. **B** — SG stateful mức ENI, chỉ Allow; NACL mới stateless mức subnet và có Deny.
4. **B** — Standby replicate đồng bộ chỉ phục vụ HA/failover; read replica mới phục vụ đọc.
5. **B** — Private subnet ra ngoài qua NAT; pull ECR/S3 nên dùng VPC endpoints để giảm phí NAT.
6. **C** — 15 phút; task dài hơn phải dùng ECS/Step Functions/Batch.
7. **B** — Code ngoài handler chạy một lần mỗi execution environment, tái dùng khi warm.
8. **B** — Đây chính là cơ chế at-least-once; vì vậy consumer phải idempotent.
9. **B** — SNS không lưu trữ; fan-out vào SQS cho mỗi service một queue durable, retry độc lập.
10. **B** — Log-based retention + consumer offsets + replay là khác biệt nền tảng so với queue xóa-sau-xử-lý.
11. **B** — FIFO đảm bảo thứ tự trong message group; nhiều groups xử lý song song được.
12. **B** — Fargate là launch type/serverless compute engine, không phải orchestrator.
13. **B** — CloudFront với 2 origins, bucket private qua Origin Access Control, kèm WAF + ACM.
14. **B** — Secrets Manager có built-in rotation (đặc biệt với RDS); Parameter Store không tự rotation.
15. **B** — ~$0.045/GB data processing dễ phình to khi pull image/gọi API nhiều; giảm bằng VPC endpoints.

</details>

### Phần 2: Bài thực hành chấm điểm

**Đề bài:** Xây "Order Processing System" hoàn chỉnh trên LocalStack: API Express `POST /orders` → lưu order (DynamoDB hoặc Postgres container) → publish `OrderCreated` lên SNS topic → fan-out vào 2 SQS queues: `email-queue` (worker giả lập gửi email, có DLQ + idempotency) và `invoice-queue` (worker tạo file PDF giả lập rồi upload S3, trả presigned URL qua API `GET /orders/:id/invoice`). Thêm 1 Lambda subscribe topic ghi audit log vào S3 bucket riêng. Toàn bộ hạ tầng tạo bằng script (`setup.sh` dùng awslocal hoặc Terraform + tflocal). Nộp repo: source 3 services + Lambda, script setup, README hướng dẫn chạy và demo, và 1 trang thiết kế "nếu deploy lên AWS thật thì kiến trúc + IAM + VPC thế nào".

**Checklist tiêu chí chấm điểm:**

- [ ] `setup.sh` (hoặc tflocal apply) tạo toàn bộ hạ tầng idempotent — chạy lại không lỗi
- [ ] POST /orders trả 201, order persist được, message publish lên SNS đúng schema (versioned: `{type, version, data}`)
- [ ] Fan-out đúng: cả email-queue và invoice-queue đều nhận event; 2 workers độc lập, một worker chết không ảnh hưởng worker kia
- [ ] Email worker: long polling, idempotent (gửi trùng event không gửi 2 email), poison message sau 3 lần fail vào DLQ
- [ ] Invoice worker upload file lên S3; GET /orders/:id/invoice trả presigned URL hoạt động và hết hạn đúng TTL
- [ ] Lambda audit nhận event từ SNS, ghi log file vào S3 bucket audit (chứng minh bằng awslocal s3 ls)
- [ ] Graceful shutdown cho workers: SIGTERM → ngừng nhận message mới, xử lý xong message in-flight rồi mới exit
- [ ] Không hardcode credentials/endpoints — đọc từ env; cấu hình chạy được cả LocalStack lẫn AWS thật chỉ bằng đổi env
- [ ] Trang thiết kế production: diagram VPC (public/private subnets, multi-AZ), SG chain, IAM roles per-service least privilege, lựa chọn compute có biện luận
- [ ] README đầy đủ: lệnh chạy, lệnh demo từng tính năng, giải thích các quyết định thiết kế chính

**Thang điểm:** mỗi mục 1 điểm, đạt ≥ 8/10 là pass.

## ✅ Tiêu chí pass tuần

- Quiz ≥ 12/15
- Hoàn thành tất cả bài tập bắt buộc (bài 1-5)
- Bài thực hành đạt ≥ 8/10 checklist
- Vẽ và trình bày miệng được kiến trúc mẫu production (VPC, multi-AZ, SG chain, messaging) trong 10 phút không nhìn tài liệu
- Trả lời chắc 4 cặp so sánh "định mệnh": SG vs NACL, Multi-AZ vs read replica, SQS vs SNS vs EventBridge vs Kafka, Secrets Manager vs Parameter Store
