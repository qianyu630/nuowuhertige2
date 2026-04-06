(function () {
    const currentUser = window.NuowuApp && NuowuApp.ensureAuth({
        message: "请先登录后再进入 DIY 创作页。",
        redirect: "login.html"
    });

    if (!currentUser) {
        return;
    }

    const canvas = document.getElementById("design-canvas");
    const ctx = canvas.getContext("2d");
    const previewImage = document.getElementById("preview-image");
    const previewEmpty = document.getElementById("preview-empty");
    const aiStatus = document.getElementById("ai-status");
    const editState = document.getElementById("edit-state");
    const sourceState = document.getElementById("source-state");
    const promptInput = document.getElementById("prompt-input");
    const workTitleInput = document.getElementById("work-title");
    const runtimeConfig = window.NUOWU_RUNTIME_CONFIG || {};

    let isDrawing = false;
    let currentColor = "#3a170e";
    let brushSize = 6;
    let history = [];
    let historyIndex = -1;
    let editingWorkId = null;
    let generatedPreviewUrl = "";
    let generatedPreviewObjectUrl = "";
    let generatedSource = "manual";

    previewImage.crossOrigin = "anonymous";

    function setStatus(message, isLoading) {
        aiStatus.textContent = message;
        aiStatus.classList.toggle("loading-dot", Boolean(isLoading));
    }

    function updateSourceBadge() {
        const sourceMap = {
            manual: "来源：手工创作",
            concept: "来源：图像生成",
            dashscope: "来源：AI 生成",
            ai: "来源：AI 生成"
        };
        sourceState.textContent = sourceMap[generatedSource] || "来源：手工创作";
    }

    function revokePreviewObjectUrl() {
        if (generatedPreviewObjectUrl) {
            URL.revokeObjectURL(generatedPreviewObjectUrl);
            generatedPreviewObjectUrl = "";
        }
    }

    function setGeneratedPreview(url, source) {
        revokePreviewObjectUrl();
        generatedPreviewUrl = url;
        generatedSource = source || "manual";
        if (url && url.startsWith("blob:")) {
            generatedPreviewObjectUrl = url;
        }
        previewImage.src = url;
        previewImage.classList.remove("hidden");
        previewEmpty.classList.add("hidden");
        updateSourceBadge();
    }

    function clearGeneratedPreview(resetSource) {
        revokePreviewObjectUrl();
        generatedPreviewUrl = "";
        if (resetSource) {
            generatedSource = "manual";
            updateSourceBadge();
        }
        previewImage.removeAttribute("src");
        previewImage.classList.add("hidden");
        previewEmpty.classList.remove("hidden");
    }

    function updateEditBadge() {
        editState.textContent = editingWorkId ? `当前状态：正在编辑作品 ${editingWorkId}` : "当前状态：新作品";
    }

    function fillWhiteBackground() {
        ctx.save();
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }

    function resetCanvas() {
        fillWhiteBackground();
        saveHistory();
    }

    function saveHistory() {
        if (historyIndex < history.length - 1) {
            history = history.slice(0, historyIndex + 1);
        }
        history.push(canvas.toDataURL("image/png"));
        historyIndex = history.length - 1;
    }

    function restoreFromDataUrl(dataUrl, saveStep) {
        const image = new Image();
        image.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            fillWhiteBackground();
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
            if (saveStep) {
                saveHistory();
            }
        };
        image.src = dataUrl;
    }

    function fitImageToCanvas(image) {
        const scale = Math.min(canvas.width / image.width, canvas.height / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        const x = (canvas.width - width) / 2;
        const y = (canvas.height - height) / 2;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        fillWhiteBackground();
        ctx.drawImage(image, x, y, width, height);
        saveHistory();
    }

    function loadImageToCanvas(src) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.crossOrigin = "anonymous";
            image.onload = () => {
                fitImageToCanvas(image);
                resolve();
            };
            image.onerror = reject;
            image.src = src;
        });
    }

    function getCanvasPoint(event) {
        const rect = canvas.getBoundingClientRect();
        const clientX = event.touches ? event.touches[0].clientX : event.clientX;
        const clientY = event.touches ? event.touches[0].clientY : event.clientY;
        return {
            x: ((clientX - rect.left) / rect.width) * canvas.width,
            y: ((clientY - rect.top) / rect.height) * canvas.height
        };
    }

    function startDrawing(event) {
        isDrawing = true;
        const point = getCanvasPoint(event);
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = brushSize;
        event.preventDefault();
    }

    function draw(event) {
        if (!isDrawing) {
            return;
        }
        const point = getCanvasPoint(event);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
        event.preventDefault();
    }

    function endDrawing() {
        if (!isDrawing) {
            return;
        }
        isDrawing = false;
        saveHistory();
    }

    function undoLastStep() {
        if (historyIndex <= 0) {
            alert("已经回到最初状态了。");
            return;
        }
        historyIndex -= 1;
        restoreFromDataUrl(history[historyIndex], false);
    }

    function drawMaskTemplate() {
        fillWhiteBackground();
        ctx.save();
        ctx.strokeStyle = "#3a170e";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.ellipse(canvas.width / 2, canvas.height / 2 - 30, 180, 210, 0, 0, Math.PI * 2);
        ctx.moveTo(canvas.width / 2 - 92, canvas.height / 2 - 78);
        ctx.ellipse(canvas.width / 2 - 92, canvas.height / 2 - 78, 34, 24, 0, 0, Math.PI * 2);
        ctx.moveTo(canvas.width / 2 + 92, canvas.height / 2 - 78);
        ctx.ellipse(canvas.width / 2 + 92, canvas.height / 2 - 78, 34, 24, 0, 0, Math.PI * 2);
        ctx.moveTo(canvas.width / 2, canvas.height / 2 - 34);
        ctx.lineTo(canvas.width / 2 - 26, canvas.height / 2 + 36);
        ctx.lineTo(canvas.width / 2 + 26, canvas.height / 2 + 36);
        ctx.closePath();
        ctx.moveTo(canvas.width / 2 - 74, canvas.height / 2 + 96);
        ctx.quadraticCurveTo(canvas.width / 2, canvas.height / 2 + 154, canvas.width / 2 + 74, canvas.height / 2 + 96);
        ctx.stroke();
        ctx.restore();
        saveHistory();
    }

    function drawClothesTemplate() {
        fillWhiteBackground();
        ctx.save();
        ctx.strokeStyle = "#3a170e";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2 - 160, canvas.height / 2 - 170);
        ctx.lineTo(canvas.width / 2 - 260, canvas.height / 2 - 30);
        ctx.lineTo(canvas.width / 2 - 182, canvas.height / 2 + 30);
        ctx.lineTo(canvas.width / 2 - 182, canvas.height / 2 + 190);
        ctx.lineTo(canvas.width / 2, canvas.height / 2 + 260);
        ctx.lineTo(canvas.width / 2 + 182, canvas.height / 2 + 190);
        ctx.lineTo(canvas.width / 2 + 182, canvas.height / 2 + 30);
        ctx.lineTo(canvas.width / 2 + 260, canvas.height / 2 - 30);
        ctx.lineTo(canvas.width / 2 + 160, canvas.height / 2 - 170);
        ctx.lineTo(canvas.width / 2 + 56, canvas.height / 2 - 170);
        ctx.lineTo(canvas.width / 2, canvas.height / 2 - 84);
        ctx.lineTo(canvas.width / 2 - 56, canvas.height / 2 - 170);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
        saveHistory();
    }

    function drawAccessoryTemplate() {
        fillWhiteBackground();
        ctx.save();
        ctx.strokeStyle = "#3a170e";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(canvas.width / 2, 180, 60, 0, Math.PI * 2);
        ctx.moveTo(canvas.width / 2, 240);
        ctx.lineTo(canvas.width / 2, 320);
        ctx.arc(canvas.width / 2, 430, 108, 0, Math.PI * 2);
        ctx.moveTo(280, 520);
        ctx.quadraticCurveTo(360, 600, 450, 640);
        ctx.moveTo(320, 620);
        ctx.arc(320, 620, 26, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        saveHistory();
    }

    function makeExport(scale) {
        const ratio = Number(scale) || 1;
        const exportCanvas = document.createElement("canvas");
        exportCanvas.width = canvas.width * ratio;
        exportCanvas.height = canvas.height * ratio;
        const exportCtx = exportCanvas.getContext("2d");
        exportCtx.fillStyle = "#ffffff";
        exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
        exportCtx.drawImage(canvas, 0, 0, exportCanvas.width, exportCanvas.height);
        return exportCanvas.toDataURL("image/png");
    }

    function getSafeTitle() {
        const raw = NuowuApp.safeText(workTitleInput.value) || NuowuApp.safeText(promptInput.value) || "未命名傩作";
        return raw.length > 30 ? `${raw.slice(0, 30)}...` : raw;
    }

    function normalizeSize(size) {
        const value = String(size || "1024x1024").trim();
        return value.includes("*") ? value : value.replace("x", "*");
    }

    function getAiEndpoint() {
        const configuredEndpoint = NuowuApp.safeText(runtimeConfig.aiEndpoint);
        if (configuredEndpoint) {
            return configuredEndpoint;
        }
        if (window.location.protocol === "http:" || window.location.protocol === "https:") {
            return "/api/generate-image";
        }
        return "";
    }

    async function readErrorMessage(response) {
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
            const data = await response.json().catch(() => null);
            if (data && typeof data.error === "string") {
                return data.error;
            }
            if (data && typeof data.message === "string") {
                return data.message;
            }
            if (data && typeof data.Message === "string") {
                return data.Message;
            }
            if (data && typeof data.Code === "string" && typeof data.Message === "string") {
                return `${data.Code}: ${data.Message}`;
            }
        }
        const text = await response.text().catch(() => "");
        return text || `接口请求失败：${response.status}`;
    }

    async function generateAliyunImage(prompt, size) {
        const endpoint = getAiEndpoint();
        if (!endpoint) {
            throw new Error("AI 服务未连接。");
        }

        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 90000);

        try {
            const response = await fetch(endpoint, {
                method: "POST",
                mode: "cors",
                cache: "no-store",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    prompt,
                    size: normalizeSize(size)
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error(await readErrorMessage(response));
            }

            const contentType = response.headers.get("content-type") || "";
            if (!contentType.includes("application/json")) {
                const rawText = await response.text().catch(() => "");
                if (rawText && rawText.includes("Hello World")) {
                    throw new Error("云函数地址可访问，但当前部署的是默认 Hello World 页面，不是生图接口。");
                }
                throw new Error("云函数返回格式不正确，请检查部署。");
            }

            const data = await response.json();
            if (!data || !data.imageDataUrl) {
                throw new Error("接口未返回可用图片。");
            }

            return {
                imageUrl: data.imageDataUrl,
                source: data.source || "dashscope",
                message: data.message || "图片已生成。"
            };
        } catch (error) {
            if (error && error.name === "AbortError") {
                throw new Error("生成超时，请稍后重试。");
            }
            throw error;
        } finally {
            window.clearTimeout(timeoutId);
        }
    }

    async function generateArtwork() {
        const prompt = NuowuApp.safeText(promptInput.value);
        const size = document.getElementById("ai-size").value;

        if (!prompt) {
            alert("请先输入提示词。");
            return;
        }

        setStatus("正在生成图片", true);
        clearGeneratedPreview(false);
        previewEmpty.textContent = "正在生成中，请稍候...";

        try {
            const result = await generateAliyunImage(prompt, size);
            setGeneratedPreview(result.imageUrl, result.source);
            setStatus(result.message, false);
        } catch (error) {
            clearGeneratedPreview(true);
            previewEmpty.textContent = "生成失败，请稍后重试。";
            setStatus((error && error.message) || "生成失败，请稍后重试。", false);
        }
    }

    async function applyPreviewToCanvas() {
        if (!generatedPreviewUrl) {
            alert("请先生成图片。");
            return;
        }
        try {
            await loadImageToCanvas(generatedPreviewUrl);
            updateSourceBadge();
            alert("已应用到画布。");
        } catch (error) {
            alert("预览图应用失败，请重新生成后再试。");
        }
    }

    function handleUpload(event) {
        const file = event.target.files[0];
        if (!file) {
            return;
        }
        const reader = new FileReader();
        reader.onload = (loadEvent) => {
            loadImageToCanvas(loadEvent.target.result).catch(() => {
                alert("素材加载失败。");
            });
        };
        reader.readAsDataURL(file);
    }

    function saveWork() {
        const savedWork = NuowuApp.upsertWork({
            id: editingWorkId || NuowuApp.createWorkId(),
            username: currentUser.username,
            title: getSafeTitle(),
            img: makeExport(1),
            prompt: NuowuApp.safeText(promptInput.value),
            source: generatedSource,
            width: canvas.width,
            height: canvas.height
        });
        editingWorkId = savedWork.id;
        updateEditBadge();
        alert("作品已保存。");
    }

    function downloadWork() {
        const scale = document.getElementById("download-scale").value;
        NuowuApp.downloadDataUrl(makeExport(scale), `${getSafeTitle()}.png`);
    }

    function loadExistingWork() {
        const params = new URLSearchParams(window.location.search);
        const editId = params.get("edit");
        if (!editId) {
            updateEditBadge();
            updateSourceBadge();
            return;
        }

        const work = NuowuApp.getWorkById(editId);
        if (!work || work.username !== currentUser.username) {
            alert("未找到可编辑作品。");
            updateEditBadge();
            updateSourceBadge();
            return;
        }

        editingWorkId = work.id;
        generatedSource = work.source || "manual";
        workTitleInput.value = work.title || "";
        promptInput.value = work.prompt || "";
        updateEditBadge();
        updateSourceBadge();
        loadImageToCanvas(work.img).catch(() => {
            resetCanvas();
        });
    }

    function bindEvents() {
        canvas.addEventListener("mousedown", startDrawing);
        canvas.addEventListener("mousemove", draw);
        canvas.addEventListener("mouseup", endDrawing);
        canvas.addEventListener("mouseleave", endDrawing);
        canvas.addEventListener("touchstart", startDrawing, { passive: false });
        canvas.addEventListener("touchmove", draw, { passive: false });
        canvas.addEventListener("touchend", endDrawing);

        document.querySelectorAll(".color-btn").forEach((button) => {
            button.addEventListener("click", () => {
                document.querySelectorAll(".color-btn").forEach((item) => item.classList.remove("active"));
                button.classList.add("active");
                currentColor = button.dataset.color;
            });
        });

        document.getElementById("brush-size").addEventListener("input", (event) => {
            brushSize = Number(event.target.value);
            document.getElementById("brush-size-value").textContent = String(brushSize);
        });

        document.querySelectorAll("[data-prompt]").forEach((button) => {
            button.addEventListener("click", () => {
                promptInput.value = button.dataset.prompt;
            });
        });

        document.getElementById("generate-btn").addEventListener("click", generateArtwork);
        document.getElementById("apply-preview-btn").addEventListener("click", applyPreviewToCanvas);
        document.getElementById("undo-btn").addEventListener("click", undoLastStep);
        document.getElementById("mask-template-btn").addEventListener("click", drawMaskTemplate);
        document.getElementById("clothes-template-btn").addEventListener("click", drawClothesTemplate);
        document.getElementById("accessory-template-btn").addEventListener("click", drawAccessoryTemplate);
        document.getElementById("clear-btn").addEventListener("click", () => {
            if (confirm("确定清空当前画布吗？")) {
                resetCanvas();
                generatedSource = "manual";
                updateSourceBadge();
            }
        });
        document.getElementById("upload-input").addEventListener("change", handleUpload);
        document.getElementById("save-btn").addEventListener("click", saveWork);
        document.getElementById("download-btn").addEventListener("click", downloadWork);
    }

    resetCanvas();
    bindEvents();
    loadExistingWork();
    setStatus("输入提示词后点击“生成图片”。", false);
    window.addEventListener("beforeunload", revokePreviewObjectUrl);
})();
