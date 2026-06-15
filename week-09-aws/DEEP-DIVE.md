# 🔬 Đào sâu — Tuần 9: AWS

> README đã cho bạn "cái gì" và "khi nào"; tài liệu này mổ xẻ "tại sao" và "bên trong nó chạy thế nào" — đủ để bạn sống sót qua các câu hỏi follow-up sâu của senior interviewer.

## 🧠 Cơ chế bên trong

### IAM policy evaluation — đường đi đầy đủ của một request

Khi một principal (user/role) gọi `s3:GetObject`, IAM **không** chỉ check "có Allow không". Nó chạy một flow xác định, theo đúng thứ tự sau, và **bất kỳ Deny nào ở bất kỳ tầng nào cũng cắt ngay**:

1. **Mặc định**: implicit deny (mọi thứ bị từ chối nếu không có gì cho phép).
2. **Organizations SCP** (Service Control Policy): nếu account nằm trong AWS Organizations, SCP đặt trần quyền cho toàn account. SCP không cấp quyền — nó chỉ giới hạn. Action ngoài SCP → deny dù IAM policy có Allow.
3. **Resource-based policy** (vd bucket policy, SQS queue policy): có thể Allow trực tiếp.
4. **Identity-based policy** (gắn vào user/role): Allow.
5. **Permissions boundary**: trần quyền tối đa của một identity (khác SCP ở chỗ áp lên 1 identity, không phải cả account).
6. **Session policy** (truyền khi `AssumeRole`): thu hẹp thêm quyền của session tạm.

Quy tắc kết hợp:
```
Explicit DENY (ở BẤT KỲ policy nào)  →  từ chối, dừng luôn
   ↓ (không có deny)
Có ít nhất một ALLOW khớp?            →  cho phép
   ↓ (không allow nào)
Implicit DENY                         →  từ chối
```
Điểm hay bị hỏi xoáy: **explicit deny luôn thắng explicit allow** — không thể "ghi đè" một deny bằng cách thêm allow. Và với cross-account: cần **cả hai** phía Allow (resource policy bên A cho phép principal bên B, VÀ identity policy bên B cho phép action) — trừ trường hợp same-account thì chỉ cần một bên Allow.

### Trust policy vs permission policy vs AssumeRole/STS

Một IAM **role** có HAI policy gắn vào, đừng nhầm:

- **Trust policy** (`AssumeRolePolicyDocument`): trả lời câu **"AI được phép trở thành role này?"** — principal nào được gọi `sts:AssumeRole`. Đây chính là resource-based policy của role.
- **Permission policy**: trả lời **"role này làm được gì sau khi đã assume?"**

```json
// Trust policy: cho phép EC2 service assume role này (dùng cho instance profile)
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "ec2.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
```

**STS** (Security Token Service) trả về temporary credentials gồm `AccessKeyId`, `SecretAccessKey`, **`SessionToken`** (3 thành phần — credentials tạm bắt buộc có session token), kèm thời hạn (15 phút–12 giờ). Hết hạn → tự xoay vòng, không có gì để leak vĩnh viễn.

**Instance profile** = container bọc một IAM role để gắn vào EC2. App trong EC2 lấy credentials bằng cách gọi **IMDS** (Instance Metadata Service) tại `http://169.254.169.254/latest/meta-data/iam/security-credentials/<role>`. SDK v3 tự làm việc này trong credential chain. Lưu ý bảo mật: luôn ép **IMDSv2** (token-based, `aws ec2 modify-instance-metadata-options --http-tokens required`) — IMDSv1 không yêu cầu token nên dính SSRF có thể đánh cắp credentials (chính là lỗ hổng vụ Capital One 2019).

### VPC routing thật sự — gói tin đi đâu

Một packet rời ENI sẽ được khớp với **route table** của subnet theo **longest-prefix match**:

```
Destination       Target
10.0.0.0/16       local          # traffic trong VPC, không bao giờ ra ngoài
0.0.0.0/0         igw-xxx         # PUBLIC subnet: default route ra Internet Gateway
0.0.0.0/0         nat-xxx         # PRIVATE subnet: default route ra NAT Gateway
```

- **IGW** không phải "thiết bị" — nó là target ảo, horizontally scaled, làm **1:1 NAT** giữa private IP của instance và public/Elastic IP của nó. Vì sao một instance ở public subnet vẫn cần public IP để ra net? Vì IGW chỉ route được khi instance **có** public IP để map.
- **NAT Gateway** làm **many-to-one NAT** (SNAT): nhiều instance private dùng chung 1 public IP của NAT. Đặt ở public subnet (vì bản thân NAT cần route ra IGW). **Một chiều**: cho phép outbound + return traffic của connection do bên trong khởi tạo, KHÔNG cho phép inbound do bên ngoài khởi tạo → đó là lý do private subnet vẫn "ra được mà không vào được".
- **Vì sao private subnet cần NAT?** Vì nó không có route tới IGW (và instance không có public IP). Mọi nhu cầu outbound (pull image ECR, `npm install`, gọi Stripe API, OS update) phải đi qua NAT. Đây là khoản tốn tiền âm thầm.

**Security Group (stateful) vs NACL (stateless)** — đào sâu hơn bảng trong README:
- SG stateful nghĩa là nó theo dõi **connection state** (giống conntrack). Bạn mở inbound 443 → response đi ra cổng ephemeral (1024–65535) tự động được cho qua, không cần outbound rule. Bạn không thể viết "Deny" rule trong SG; muốn chặn → đơn giản là không Allow.
- NACL stateless: mỗi chiều độc lập. Mở inbound 443 thì **phải** mở outbound ephemeral ports (1024–65535) cho return traffic, nếu không response bị drop — đây là bug kinh điển khi người ta siết NACL. NACL đánh giá theo **rule number** tăng dần, rule đầu tiên khớp thắng (giống iptables), nên đặt rule deny IP xấu ở số nhỏ.
- Best practice nâng cao: **SG referencing SG** thay vì CIDR. `RDS-SG: allow 5432 from App-SG`. Khi App scale ra IP mới, không cần sửa rule — vì rule tham chiếu *danh tính* (SG) chứ không phải địa chỉ.

### S3 không phải filesystem — và consistency model

- **Strong read-after-write từ Dec 2020**: PUT một object mới → GET ngay sau đó **luôn** thấy. Overwrite (PUT đè) và DELETE cũng strongly consistent. Trước 2020 chỉ eventual cho overwrite/delete — nhiều code cũ còn retry phòng eventual, giờ không cần nữa. Lưu ý: consistency này áp cho **một object key**; **LIST** (ListObjects) phản ánh ngay nhưng không có khái niệm "transaction" qua nhiều key.
- **Vì sao S3 KHÔNG phải filesystem?** Key `a/b/c.txt` là một **chuỗi phẳng**, không có thư mục thật — "folder" chỉ là prefix do console giả lập. Hệ quả: không có atomic rename (rename = copy + delete, không nguyên tử); không append vào file đang có (phải ghi lại object mới); không file locking; latency mỗi GET/PUT là một HTTP round-trip (chục ms), không phải µs như đĩa. Throughput scale theo **prefix**: ~3500 PUT và ~5500 GET mỗi giây **mỗi prefix** — muốn cao hơn thì rải key qua nhiều prefix.
- **Storage class & cơ chế chi phí**: bạn trả cho (1) storage GB/tháng, (2) request, (3) retrieval. Standard-IA rẻ storage nhưng tính phí retrieval + có **minimum 30 ngày, 128KB**. Glacier rẻ nhất storage nhưng retrieval mất phút–giờ. **Intelligent-Tiering** thu phí monitoring nhỏ/object để tự dịch chuyển — đáng khi access pattern khó đoán; không đáng cho hàng tỷ object bé (phí monitoring vượt lợi ích).

### Lambda — execution model & cold start mổ xẻ

Một invocation chạy trong **execution environment** (microVM Firecracker). Vòng đời:
```
INIT  ──► INVOKE ──► (giữ ấm) ──► INVOKE ──► ... ──► (idle vài phút) ──► tear down
  │
  └─ tải code + chạy mọi thứ NGOÀI handler (import, tạo SDK client, mở pool)
     = đây là phần "cold". Chạy ĐÚNG MỘT LẦN mỗi environment.
```
- **Cold start** = thời gian của pha INIT: tạo microVM + tải runtime + tải/giải nén code + chạy init code. Mỗi environment chỉ xử lý **một request tại một thời điểm** — concurrency = số environment chạy song song. Spike 100 request đồng thời cần 100 environment → tới 100 cold start.
- **Vì sao khởi tạo ngoài handler quan trọng**: code module-scope (vd `const ddb = new DynamoDBClient()`, pool Postgres) chạy ở pha INIT và **được tái dùng** cho mọi invoke ấm tiếp theo trên cùng environment. Đặt trong handler = trả giá mỗi request.
- **Provisioned Concurrency**: giữ sẵn N environment đã qua INIT, luôn ấm → loại cold start cho N concurrency đầu, nhưng trả tiền 24/7. **SnapStart** (Java, và đang mở rộng) chụp snapshot bộ nhớ sau INIT để phục hồi nhanh.
- **/tmp**: 512MB (tới 10GB), tồn tại theo environment — tái dùng giữa invoke ấm. Đừng giả định nó sạch giữa các request (có thể dính rác từ invoke trước); cũng đừng dựa vào nó để lưu state lâu dài.
- **Lambda trong VPC**: ngày xưa mỗi cold start phải tạo ENI → chậm hàng giây. Từ 2019 AWS dùng **Hyperplane ENI** (shared, tạo sẵn theo subnet+SG) nên cold start không còn phạt nặng. Nhưng vẫn có giới hạn **IP trong subnet**: nhiều function VPC + concurrency cao có thể **cạn IP** subnet → invoke fail. Fix: subnet `/22` hoặc lớn hơn cho Lambda.

### SQS — visibility timeout, at-least-once, DLQ ở mức cơ chế

- Khi `ReceiveMessage`, SQS không xóa message — nó **đánh dấu in-flight** và bắt đầu đếm **visibility timeout**. Trong khoảng đó message vô hình với consumer khác. Bạn phải `DeleteMessage` (dùng `ReceiptHandle`) trước khi timeout hết. Quá hạn → message **hiện lại** → có thể bị xử lý lần hai.
- **At-least-once là hệ quả tất yếu**, không phải bug: SQS không thể phân biệt "consumer crash" với "consumer chậm" — cả hai đều là "timeout mà chưa delete". Vì vậy **idempotency là bắt buộc**, không phải tùy chọn. Cách làm: dedup theo business key (`orderId`) trong store có ràng buộc unique (Redis `SET NX`, hoặc Postgres `INSERT ... ON CONFLICT DO NOTHING`).
- **Visibility timeout nên đặt bao nhiêu?** ≥ thời gian xử lý tối đa P99, có biên an toàn. Nếu xử lý lâu hơn dự kiến, gọi `ChangeMessageVisibility` để **gia hạn** (heartbeat) thay vì đặt timeout cứng quá lớn. README đã nêu rule "đủ lớn"; điểm sâu là: timeout quá ngắn → duplicate; quá dài → message lỗi (crash) mất lâu mới retry.
- **DLQ qua RedrivePolicy**: SQS đếm `ApproximateReceiveCount` mỗi lần message được nhận. Vượt `maxReceiveCount` → SQS tự chuyển message sang DLQ. Cơ chế này tách **poison message** (data hỏng khiến consumer luôn throw) khỏi message tốt, tránh retry vô hạn làm nghẽn queue. Đặt alarm `ApproximateNumberOfMessagesVisible > 0` trên DLQ.
- **Standard vs FIFO sâu hơn**: Standard có thể **duplicate và đảo thứ tự** (vì phân tán đa server). FIFO đảm bảo order trong `MessageGroupId` và dedup bằng `MessageDeduplicationId` (hoặc content-hash) trong cửa sổ **5 phút** — đây là "exactly-once" trong 5 phút, không phải vĩnh viễn. FIFO đánh đổi throughput: 300 msg/s (3000 với batch), và một group bị nghẽn (poison) sẽ chặn toàn group.

## 🧪 Ví dụ nâng cao

### 1. IAM least-privilege với condition (chặt hơn ví dụ README)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadWriteOwnPrefixOnly",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": "arn:aws:s3:::my-app-uploads/${aws:PrincipalTag/tenant}/*",
      "Condition": {
        "StringEquals": { "s3:x-amz-server-side-encryption": "aws:kms" },
        "Bool": { "aws:SecureTransport": "true" }
      }
    },
    {
      "Sid": "DenyUnlessFromVPCE",
      "Effect": "Deny",
      "Action": "s3:*",
      "Resource": ["arn:aws:s3:::my-app-uploads", "arn:aws:s3:::my-app-uploads/*"],
      "Condition": { "StringNotEquals": { "aws:sourceVpce": "vpce-0abc123" } }
    }
  ]
}
```
Điểm đáng nói: (a) `${aws:PrincipalTag/tenant}` — multi-tenant isolation bằng **một** policy thay vì N policy; (b) `aws:SecureTransport` ép TLS; (c) một **explicit Deny** khóa truy cập chỉ từ VPC Endpoint — nhớ rằng deny này thắng mọi allow.

### 2. Kiến trúc event-driven: S3 → Lambda → SQS → worker

```
[Client]──presigned PUT──►[S3 raw bucket]
                                │ s3:ObjectCreated:* (event notification)
                                ▼
                          [Lambda ingest]  validate + tạo job message
                                │ SendMessage
                                ▼
                          [SQS jobs + DLQ]
                                │ long poll
                                ▼
                          [Worker (Fargate)]  xử lý nặng (resize/transcode), ghi kết quả S3 + DB
```
Vì sao chèn SQS giữa Lambda và worker thay vì Lambda gọi thẳng worker? **Decouple + buffer + backpressure**: S3 có thể bắn 10k event/phút lúc cao điểm; SQS hấp thụ spike, worker kéo theo tốc độ của nó, không bị đè. Lambda chỉ làm việc nhẹ (validate + enqueue) nên rẻ và nhanh.

### 3. Idempotency cho Lambda + SQS (chống xử lý trùng)

```js
// Lambda nhận event SQS (batch). Dedup bằng DynamoDB conditional write.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { PutItemCommand } from '@aws-sdk/client-dynamodb';
const ddb = new DynamoDBClient({});          // NGOÀI handler → tái dùng khi warm

export const handler = async (event) => {
  const failures = [];
  for (const record of event.Records) {
    const { orderId } = JSON.parse(record.body);
    try {
      // Idempotency key: chỉ ghi nếu chưa tồn tại → lần thứ 2 sẽ throw
      await ddb.send(new PutItemCommand({
        TableName: 'processed_orders',
        Item: { pk: { S: `order#${orderId}` }, ttl: { N: String(Date.now()/1000 + 86400) } },
        ConditionExpression: 'attribute_not_exists(pk)',
      }));
      await doSideEffect(orderId);            // gửi email / charge — chỉ chạy đúng 1 lần
    } catch (e) {
      if (e.name === 'ConditionalCheckFailedException') continue; // đã xử lý → bỏ qua, không lỗi
      failures.push({ itemIdentifier: record.messageId });        // báo SQS retry message này
    }
  }
  return { batchItemFailures: failures };     // partial batch response: chỉ retry message lỗi
};
```
Hai điểm vàng: **conditional write** làm dedup nguyên tử; **`batchItemFailures`** (partial batch response) để chỉ message lỗi quay lại queue, không retry cả batch (tránh xử lý lại message đã thành công).

### 4. Presigned URL — nâng cao với điều kiện upload

README đã có presigned PUT cơ bản. Sâu hơn: dùng **presigned POST** (policy-based) để ép giới hạn ngay tại S3, client không vượt được:
```js
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
const { url, fields } = await createPresignedPost(s3, {
  Bucket: 'uploads', Key: `u/${userId}/${uuid}`,
  Conditions: [
    ['content-length-range', 0, 5 * 1024 * 1024],        // ép max 5MB — S3 từ chối nếu vượt
    ['starts-with', '$Content-Type', 'image/'],          // chỉ image/*
  ],
  Expires: 300,
});
// client gửi multipart form: ...fields + file. S3 enforce policy phía nó.
```
Khác PUT presigned: POST cho phép đặt **content-length-range** mà PUT không có — bảo vệ thật sự khỏi client upload file khổng lồ.

### 5. Chọn ALB vs NLB vs API Gateway — bảng quyết định nhanh

| Tiêu chí | ALB (L7) | NLB (L4) | API Gateway |
|---|---|---|---|
| OSI layer | 7 (HTTP) | 4 (TCP/UDP/TLS) | 7 (managed) |
| Routing nội dung | host/path/header | không (chỉ port) | path + method |
| Static IP | không (DNS) | có (EIP/AZ) | không |
| Auth/throttle/API key | qua WAF/Cognito | không | built-in |
| mTLS, gRPC throughput cao | hạn chế | tốt | mTLS có (REST) |
| Giá theo | LCU + giờ | NLCU + giờ | per-request (đắt khi RPS lớn) |
| Hợp với | microservices HTTP nội bộ | TCP thuần, source-IP preserve, throughput | API public cần auth/quota, serverless |

Heuristic: API public cần auth + rate limit + Lambda → **API Gateway**. Microservices HTTP sau VPC, RPS cao đều → **ALB** (rẻ hơn API GW ở RPS lớn). TCP/UDP, static IP, hoặc làm origin cho API GW VPC Link → **NLB**.

## 🐛 Bẫy & sự cố production

**1. IAM quá rộng (`"Action":"*"`, `"Resource":"*"`)**
- *Dấu hiệu*: policy có `s3:*` hoặc `*` trên `*`; IAM Access Analyzer cảnh báo; một service bị compromise đọc được mọi bucket.
- *Fix*: bám least-privilege, generate policy từ CloudTrail (Access Analyzer policy generation), giới hạn theo ARN cụ thể + condition. Dùng permissions boundary cho dev tự tạo role.

**2. Lambda trong VPC: cold start chậm + cạn ENI/IP**
- *Dấu hiệu*: p99 latency nhảy vọt lúc scale; lỗi `ENILimitReached` hoặc invoke fail khi concurrency cao; subnet hết IP.
- *Fix*: chỉ đặt Lambda trong VPC khi thật sự cần (truy cập RDS/ElastiCache private); subnet riêng `/22`+ cho Lambda; dùng VPC endpoint thay vì NAT cho AWS API; cân nhắc RDS Proxy + truy cập qua nó.

**3. SQS xử lý chậm hơn visibility timeout → duplicate**
- *Dấu hiệu*: cùng `orderId` được xử lý nhiều lần (email gửi 2 lần, charge 2 lần); `ApproximateReceiveCount` > 1 dù message ổn.
- *Fix*: tăng visibility timeout > P99 processing; heartbeat bằng `ChangeMessageVisibility` cho job dài; **bắt buộc idempotency** (conditional write / `SET NX`). Đừng coi đây là bug của SQS — là tính chất at-least-once.

**4. S3 public bucket lộ data**
- *Dấu hiệu*: object truy cập được không cần auth; Trusted Advisor/Macie cảnh báo; ACL public-read hoặc bucket policy `Principal:"*"`.
- *Fix*: bật **Block Public Access** ở mức account (mặc định đã bật từ 2023); serve private qua CloudFront + **Origin Access Control**; SSE-KMS; bật S3 access logging + versioning. Đừng dùng ACL — chuyển sang bucket policy.

**5. NAT Gateway tốn tiền (data processing)**
- *Dấu hiệu*: hóa đơn `NatGateway-Bytes` phình to; nhiều traffic ECR pull / S3 / DynamoDB đi qua NAT (~$0.045/GB cộng giờ NAT).
- *Fix*: **Gateway VPC Endpoint** cho S3 + DynamoDB (miễn phí, bỏ NAT cho 2 service này); **Interface Endpoint** cho ECR/Secrets/SQS; một NAT per-AZ để tránh cross-AZ charge nhưng cân nhắc gộp nếu traffic thấp; dùng VPC endpoint cho ECR khi pull image nhiều.

**6. RDS không Multi-AZ → downtime khi failover/patch**
- *Dấu hiệu*: maintenance window làm DB offline; một AZ hỏng làm app chết; không có standby.
- *Fix*: bật Multi-AZ (synchronous standby, failover DNS ~60–120s); app **bắt lỗi connection và retry** với backoff vì failover làm rớt connection đang mở; RDS Proxy giúp giữ client connection trong lúc failover; test failover chủ động (`reboot with failover`).

**7. Chi phí data transfer ẩn (cross-AZ, cross-region)**
- *Dấu hiệu*: hóa đơn `DataTransfer-Regional-Bytes` cao bất ngờ; app gọi chéo AZ liên tục (tasks AZ-a gọi RDS AZ-b, hoặc inter-service chéo AZ); cross-region replication.
- *Fix*: ý thức cross-AZ ~$0.01/GB **mỗi chiều**; dùng topology-aware routing / cùng-AZ khi có thể; gom traffic nội VPC; CloudFront giảm egress ra internet (rẻ hơn S3/EC2 egress trực tiếp); xem **Cost Explorer** group by usage type.

## ⚖️ Đánh đổi & quyết định thiết kế

### Compute: EC2 vs ECS/Fargate vs Lambda
- **EC2 trần**: kiểm soát tối đa, rẻ nhất per-unit với Reserved/Spot, nhưng bạn tự lo patching/scaling/AMI. Hợp workload đặc thù (GPU, kernel tuning, license theo core).
- **ECS Fargate**: zero node management, scale theo task, trả per vCPU/RAM. Đắt hơn EC2 per-unit nhưng tiết kiệm công vận hành. Sweet spot cho microservices HTTP traffic đều.
- **Lambda**: scale-to-zero, pay-per-invocation, zero-ops nhất. Đắt khi chạy liên tục tải cao (so per giờ thì container thắng), giới hạn 15 phút, có cold start. Hợp event-driven, spiky, cron, glue code.
- *Đường ranh chi phí*: traffic đều và cao → container rẻ hơn Lambda; traffic spiky/thưa → Lambda rẻ hơn (không trả tiền khi idle). Nhiều hệ thống lai: ECS cho API chính, Lambda cho side-effect/cron.

### Messaging: SQS vs SNS vs EventBridge (vs Kafka)
- **SQS**: 1 producer → 1 consumer group, work queue, buffer/backpressure, DLQ. Chọn khi cần *xử lý job* có retry.
- **SNS**: pub/sub push fan-out, không lưu. Chọn khi cần *broadcast* tới nhiều endpoint; pattern durable = SNS → nhiều SQS.
- **EventBridge**: pub/sub + routing theo nội dung JSON, schema registry, 200+ integration, archive/replay. Chọn làm *xương sống event-driven giữa domain*. Throughput thấp hơn và latency cao hơn SNS một chút — đổi lấy routing thông minh.
- **Kafka/MSK**: log-based, replay, nhiều consumer group đọc offset độc lập, throughput cực cao — nhưng phải tự vận hành (hoặc MSK Serverless). Chọn khi event sourcing/stream processing/replay là yêu cầu cứng.
- *Heuristic*: job queue → SQS; broadcast durable → SNS+SQS; event bus đa domain + filter → EventBridge; stream + replay + throughput khủng → Kafka.

### RDS vs DynamoDB
- **RDS** (relational): join, transaction ACID đa bảng, query linh hoạt (ad-hoc SQL), strong consistency. Đổi lại scale theo chiều dọc + read replica, có `max_connections`, vận hành phức tạp hơn ở quy mô lớn.
- **DynamoDB** (NoSQL key-value): scale ngang gần như vô hạn, single-digit ms ổn định, serverless, không lo connection. Đổi lại: **phải thiết kế quanh access pattern trước** (partition key / GSI), join/ad-hoc query yếu, transaction giới hạn.
- *Quyết định*: model quan hệ phức tạp + báo cáo ad-hoc → RDS. Access pattern biết trước + scale ngực khủng + latency ổn định + serverless → DynamoDB. Thực tế hay dùng cả hai (RDS cho core domain, DynamoDB cho session/idempotency/high-scale lookup).

## 🎯 Câu hỏi phỏng vấn NÂNG CAO

**Q1. IAM đánh giá quyền theo thứ tự nào, và explicit deny có thể bị ghi đè không?**
Bắt đầu implicit deny → SCP (trần account) → resource/identity policy (Allow) → permissions boundary → session policy. Kết hợp: **bất kỳ explicit Deny nào ở bất kỳ tầng nào → từ chối ngay, không thể ghi đè bằng Allow**. Không có Allow nào khớp → implicit deny. Cross-account same-account khác nhau: cross-account cần Allow ở *cả* resource policy lẫn identity policy.

**Q2. Trust policy khác permission policy của một role thế nào?**
Trust policy = "ai được assume role này" (resource-based, `sts:AssumeRole`, principal là service/account/user). Permission policy = "role làm được gì sau khi assume". Thiếu trust policy đúng → không ai assume được dù permission rộng cỡ nào.

**Q3. Lambda cold start là gì, và vì sao đặt code ngoài handler giúp giảm?**
Cold start = pha INIT tạo microVM + load runtime + chạy init code, xảy ra mỗi khi tạo execution environment mới (mỗi đơn vị concurrency). Code module-scope chạy ở INIT và **tái dùng** cho mọi invoke ấm trên environment đó, nên tạo SDK client / DB pool ngoài handler chỉ trả giá một lần. Giảm thêm: bundle nhỏ (esbuild), tăng memory (CPU tỉ lệ thuận), Provisioned Concurrency, tránh VPC nếu không cần.

**Q4. SQS đảm bảo gì về delivery và ordering? Standard vs FIFO?**
Standard: at-least-once (có thể trùng), best-effort ordering (có thể đảo), throughput không giới hạn. FIFO: exactly-once trong cửa sổ dedup 5 phút (qua `MessageDeduplicationId`), order chặt trong `MessageGroupId`, throughput 300/3000 msg/s. Vì at-least-once là bản chất → consumer phải idempotent.

**Q5. Security Group khác NACL ở đâu, và bug stateless kinh điển là gì?**
SG: mức ENI, stateful (return traffic tự cho qua), chỉ Allow, đánh giá mọi rule. NACL: mức subnet, stateless, có Allow+Deny, đánh giá theo rule number. Bug kinh điển: NACL chặn outbound ephemeral ports (1024–65535) → response của inbound bị drop dù inbound đã allow, vì stateless không tự cho return traffic.

**Q6. Vì sao private subnet cần NAT Gateway, và làm sao giảm chi phí NAT?**
Private subnet không có route tới IGW (và instance không có public IP), nên outbound phải qua NAT (đặt ở public subnet, SNAT many-to-one, một chiều). Giảm chi phí: Gateway VPC Endpoint cho S3/DynamoDB (free, bỏ NAT), Interface Endpoint cho ECR/Secrets/SQS, NAT per-AZ tránh cross-AZ charge.

**Q7. Visibility timeout đặt sai gây hậu quả gì cả hai phía?**
Quá ngắn so với thời gian xử lý → message hiện lại khi worker còn đang chạy → duplicate processing. Quá dài → message của worker đã crash mất rất lâu mới được retry → tăng latency phục hồi. Giải pháp tốt: đặt vừa P99 + heartbeat `ChangeMessageVisibility` cho job dài.

**Q8. S3 strong consistency áp dụng cho gì, và vì sao S3 vẫn không thay được filesystem?**
Từ 2020, read-after-write strong cho PUT mới, overwrite và delete — trên từng key. Nhưng S3 không có thư mục thật (key phẳng), không atomic rename, không append, không file lock, latency HTTP-level, throughput giới hạn theo prefix. Nó là object store, không phải POSIX filesystem.

**Q9. Khi nào chọn DynamoDB thay RDS cho một service Node.js?**
Khi access pattern biết trước và ổn định, cần scale ngang lớn + latency ms ổn định + serverless (không lo `max_connections` khi Lambda/Fargate bùng nổ). Tránh khi cần join phức tạp, transaction đa bảng, hoặc query ad-hoc cho báo cáo — lúc đó RDS hợp hơn.

## 📚 Đọc thêm

- **AWS Well-Architected Framework** — 6 pillars, đọc kỹ Security + Reliability + Cost Optimization pillar whitepapers.
- **IAM policy evaluation logic** — docs: "Policy evaluation logic" (luồng SCP → resource → identity → boundary → session).
- **AWS Lambda execution environment** — docs: "Lambda execution environment lifecycle" + bài "Operating Lambda: Performance optimization".
- **Amazon SQS** — "Visibility timeout", "Amazon SQS dead-letter queues", "FIFO queues" trong SQS Developer Guide.
- **Amazon S3** — "Amazon S3 data consistency model" + "Best practices design patterns: optimizing S3 performance".
- **VPC** — "VPC networking components", "NAT gateways", "Compare security groups and network ACLs".
- **Cost** — "AWS Pricing", "NAT Gateway pricing", "Data transfer costs" + dùng Cost Explorer/Compute Optimizer.
- Sách/series: *AWS Certified Solutions Architect* (Stephane Maarek), và re:Invent talks về "Serverless at scale" + "Advanced VPC design".
