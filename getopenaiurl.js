(async function () {
    console.log("⏳ 正在获取凭证并请求生成链接...");

    try {
        // 1. 获取当前的 Access Token
        const session = await fetch("/api/auth/session").then((r) => r.json());
        if (!session || !session.accessToken) {
            throw new Error("无法获取 Token，请确保你已登录 ChatGPT 网页版");
        }

        // 2. 构造 Plus 版 Payload
        // 注意：个人版参数结构与 Team 版不同
        const payload = {
            "entry_point": "all_plans_pricing_modal",
            "plan_type": "chatgptpro",
            "billing_details": {
                "country": "US",
                "currency": "USD"
            },
            "checkout_ui_mode": "hosted", // 确保跳转到 Stripe 托管页面
            "cancel_url": "https://chatgpt.com/",
            "success_url": "https://chatgpt.com/"
        };

        // 3. 发送请求到后端支付接口
        const response = await fetch(
            "https://chatgpt.com/backend-api/payments/checkout",
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${session.accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            }
        );

        const data = await response.json();

        // 4. 输出结果
        if (data.url) {
            console.clear();
            console.log(
                "%c✅ 成功生成个人 Plus 支付链接：",
                "color: #10a37f; font-size: 20px; font-weight: bold;"
            );
            console.log("%c该链接可直接发给他人代付", "color: #e67e22; font-weight: bold;");
            console.log("\n" + data.url);
        } else {
            console.error("❌ 生成失败：", data);
            if (data.detail) console.error("错误详情:", data.detail);
        }
    } catch (e) {
        console.error("❌ 执行出错:", e.message);
    }
})();