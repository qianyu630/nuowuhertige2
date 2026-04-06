(function () {
    const currentUser = window.NuowuApp && NuowuApp.ensureAuth({
        message: "请先登录后再查看作品库。",
        redirect: "login.html"
    });

    if (!currentUser) {
        return;
    }

    const worksGrid = document.getElementById("works-grid");
    const emptyState = document.getElementById("empty-state");
    const metricsBox = document.getElementById("work-metrics");
    const customModal = document.getElementById("custom-modal");

    function sourceLabel(source) {
        const labels = {
            manual: "手工创作",
            concept: "概念图生成",
            dashscope: "AI 生成",
            pollinations: "AI 生成",
            ai: "AI 生成"
        };
        return labels[source] || "手工创作";
    }

    function renderMetrics(works) {
        const aiCount = works.filter((item) => item.source && item.source !== "manual").length;
        const latest = works[0] ? NuowuApp.formatDisplayDate(works[0].updatedAt) : "暂无";
        metricsBox.innerHTML = `
            <div class="metric">
                <span class="metric-value">${works.length}</span>
                <span class="metric-label">总作品数</span>
            </div>
            <div class="metric">
                <span class="metric-value">${aiCount}</span>
                        <span class="metric-label">生成作品</span>
            </div>
            <div class="metric">
                <span class="metric-value">${latest}</span>
                <span class="metric-label">最近更新</span>
            </div>
        `;
    }

    function openCustomModal(work) {
        document.getElementById("custom-work-title").value = work.title;
        document.getElementById("custom-work-id").value = work.id;
        document.getElementById("custom-designer").value = currentUser.username;
        document.getElementById("custom-prompt").value = work.prompt || "";
        customModal.classList.add("is-open");
        document.body.style.overflow = "hidden";
    }

    function closeCustomModal() {
        customModal.classList.remove("is-open");
        document.body.style.overflow = "";
    }

    function renderWorks() {
        const works = NuowuApp.getUserWorks(currentUser.username);
        renderMetrics(works);
        worksGrid.innerHTML = "";

        if (!works.length) {
            emptyState.classList.remove("hidden");
            return;
        }

        emptyState.classList.add("hidden");

        works.forEach((work) => {
            const card = document.createElement("article");
            card.className = "card work-card";
            card.innerHTML = `
                <div class="card-media">
                    <img src="${work.img}" alt="${work.title}" class="work-thumb">
                </div>
                <div class="card-body">
                    <div class="meta-line">
                        <span class="badge">${sourceLabel(work.source)}</span>
                        <span>${NuowuApp.formatDisplayDate(work.updatedAt)}</span>
                    </div>
                    <h3 class="card-title">${work.title}</h3>
                    <p class="work-prompt">${work.prompt ? `提示词：${work.prompt}` : "提示词：手工绘制作品"}</p>
                    <div class="work-actions">
                        <a class="btn-secondary" href="diy.html?edit=${encodeURIComponent(work.id)}"><i class="fa-solid fa-pen"></i> 继续编辑</a>
                        <button class="btn-secondary" type="button" data-download="${work.id}"><i class="fa-solid fa-download"></i> 下载</button>
                        <button class="btn" type="button" data-custom="${work.id}"><i class="fa-solid fa-cube"></i> 定制制作</button>
                    </div>
                </div>
            `;
            worksGrid.appendChild(card);
        });

        worksGrid.querySelectorAll("[data-download]").forEach((button) => {
            button.addEventListener("click", () => {
                const work = NuowuApp.getWorkById(button.dataset.download);
                if (work) {
                    NuowuApp.downloadDataUrl(work.img, `${work.title}.png`);
                }
            });
        });

        worksGrid.querySelectorAll("[data-custom]").forEach((button) => {
            button.addEventListener("click", () => {
                const work = NuowuApp.getWorkById(button.dataset.custom);
                if (work) {
                    openCustomModal(work);
                }
            });
        });
    }

    document.getElementById("close-custom-modal").addEventListener("click", closeCustomModal);
    document.getElementById("cancel-custom-btn").addEventListener("click", closeCustomModal);
    customModal.addEventListener("click", (event) => {
        if (event.target === customModal) {
            closeCustomModal();
        }
    });

    renderWorks();
})();
