// 获取DOM元素
const canvas = document.getElementById('game-board');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const finalScoreElement = document.getElementById('final-score');
const gameOverElement = document.getElementById('game-over');
const lastScoreElement = document.getElementById('last-score');
const pauseMenuElement = document.getElementById('pause-menu');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const restartBtn = document.getElementById('restart-btn');
const playAgainBtn = document.getElementById('play-again-btn');
const continueBtn = document.getElementById('continue-btn');
const restartFromPauseBtn = document.getElementById('restart-from-pause-btn');
const toggleChangelogBtn = document.getElementById('toggle-changelog-btn');
const changelogElement = document.getElementById('changelog');
const changelogCloseBtn = document.getElementById('changelog-close-btn');
const speedSlider = document.getElementById('speed-slider');
const speedValue = document.getElementById('speed-value');
const wrapToggle = document.getElementById('wrap-toggle');
const btnUp = document.getElementById('btn-up');
const btnDown = document.getElementById('btn-down');
const btnLeft = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');

// 游戏参数（可由配置覆盖）
let gridSize = 20; // 每个格子的大小
let tileCount = 20; // 游戏区域边长（tileCount x tileCount）
let baseSpeed = 1; // 手动基础速度（滑块控制）
let speedLevel = 1; // 难度等级（随分数提升）
let wrapMode = false; // 边界模式：false撞墙死亡，true穿墙

// 配置对象与默认值
let gameConfig = {
    gridSize: 20,
    tileCount: 20,
    initialBaseSpeed: 1,
    initialSpeedLevel: 1,
    speedLevelMax: 7,
    scorePerSpeedLevel: 5,
    autoLevelUpEnabled: true,
    wrapModeDefault: false,
    obstacleCount: 10
};

function getEffectiveSpeed() {
    const maxLevel = gameConfig.speedLevelMax ?? 7;
    return Math.min(baseSpeed + (speedLevel - 1), maxLevel);
}
let score = 0;
let lastScore = 0;
let foodsEaten = 0; // 统计已吃食物数量（用于障碍刷新）

// 初始化速度显示（显示实际生效速度）
speedValue.textContent = getEffectiveSpeed();

// 监听速度滑块变化
speedSlider.addEventListener('input', function() {
    baseSpeed = parseInt(this.value, 10);
    speedValue.textContent = getEffectiveSpeed();
});

// 蛇的初始位置和速度
let snake = [
    { x: 15, y: 15 } // 初始位置在中间
];
let velocityX = 0;
let velocityY = 0;

// 食物：支持多种类型
// 类型：normal(普通+10分)、big(大食物+20分)、slow(减速3秒)
const FOOD_TYPES = {
    normal: { score: 10, color: 'red' },
    big: { score: 20, color: '#FFB300' }, // 金色
    slow: { score: 0, color: '#2196F3' } // 蓝色，触发减速效果
};

let currentFood = { x: 10, y: 10, type: 'normal' };
// 障碍物集合
let obstacles = [];

function isObstacle(x, y) {
    return obstacles.some(o => o.x === x && o.y === y);
}

function generateObstacles(count) {
    const target = Math.max(0, Math.min(count || 0, tileCount * tileCount - snake.length - 1));
    const set = new Set();
    // 预防初始蛇与食物位置
    const forbidden = new Set([
        `${currentFood.x},${currentFood.y}`,
        ...snake.map(p => `${p.x},${p.y}`)
    ]);
    while (set.size < target) {
        const x = Math.floor(Math.random() * tileCount);
        const y = Math.floor(Math.random() * tileCount);
        const key = `${x},${y}`;
        if (!forbidden.has(key)) set.add(key);
    }
    obstacles = Array.from(set).map(k => {
        const [x, y] = k.split(',').map(Number);
        return { x, y };
    });
}

// 游戏状态
let gameRunning = false;
let gamePaused = false;

// 游戏主循环
function gameLoop() {
    if (gameRunning && !gamePaused) {
        updateGame();
        drawGame();
        // 绘制格子线条
        drawGrid();
        // 绘制HUD（例如减速提示）
    drawHUD();
}
    const eff = getEffectiveSpeed();
    setTimeout(gameLoop, 1000 / eff);
}

// 绘制格子线条
function drawGrid() {
    ctx.strokeStyle = "#2c2c3c";
    ctx.lineWidth = 0.5;
    
    // 绘制垂直线，只在游戏区域内绘制
    for (let i = 0; i <= tileCount; i++) {
        ctx.beginPath();
        ctx.moveTo(i * gridSize, 0);
        ctx.lineTo(i * gridSize, tileCount * gridSize);
        ctx.stroke();
    }
    
    // 绘制水平线，只在游戏区域内绘制
    for (let i = 0; i <= tileCount; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * gridSize);
        ctx.lineTo(tileCount * gridSize, i * gridSize);
        ctx.stroke();
    }
}

// 更新游戏状态
function updateGame() {
    // 移动蛇头
    let head = { x: snake[0].x + velocityX, y: snake[0].y + velocityY };

    // 边界处理：穿墙模式则从另一侧出来
    if (wrapMode) {
        if (head.x < 0) head.x = tileCount - 1;
        else if (head.x >= tileCount) head.x = 0;
        if (head.y < 0) head.y = tileCount - 1;
        else if (head.y >= tileCount) head.y = 0;
    }

    snake.unshift(head);

    // 检查是否吃到食物（支持多类型）
    if (head.x === currentFood.x && head.y === currentFood.y) {
        const fcfg = FOOD_TYPES[currentFood.type] || FOOD_TYPES.normal;
        score += fcfg.score;
        scoreElement.textContent = score;
        // 吃到食物计数（包含减速食物）
        foodsEaten++;

        // 根据食物数量自动提升速度等级（每5个食物+1级，最高speedLevelMax）
        if (gameConfig.autoLevelUpEnabled) {
            const maxLevel = gameConfig.speedLevelMax ?? 7;
            const baseLevel = gameConfig.initialSpeedLevel ?? 1;
            speedLevel = Math.min(baseLevel + Math.floor(foodsEaten / 5), maxLevel);
        }
        // 减速食物：降低一个速度等级（不低于1）
        if (currentFood.type === 'slow') {
            speedLevel = Math.max(1, speedLevel - 1);
        }
        // 每吃5个食物刷新一次障碍物
        if (foodsEaten % 5 === 0) {
            const defaultCount = Math.max(1, Math.floor(tileCount * tileCount * 0.04));
            const count = gameConfig.obstacleCount ?? defaultCount;
            generateObstacles(count);
        }
        speedValue.textContent = getEffectiveSpeed();
        generateFood(); // 食物吃完后刷新产生新的食物
    } else {
        // 如果没吃到食物，移除蛇尾
        snake.pop();
    }

    // 检查游戏是否结束
    if (isGameOver()) {
        endGame();
    }
}

// 绘制游戏
function drawGame() {
    // 清空画布，使用深色背景
    ctx.fillStyle = '#181825';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 绘制游戏区域背景
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(0, 0, tileCount * gridSize, tileCount * gridSize);

    // 绘制障碍物
    if (obstacles && obstacles.length) {
        ctx.save();
        ctx.fillStyle = '#455A64';
        ctx.strokeStyle = '#263238';
        obstacles.forEach(o => {
            ctx.fillRect(o.x * gridSize, o.y * gridSize, gridSize, gridSize);
            ctx.strokeRect(o.x * gridSize, o.y * gridSize, gridSize, gridSize);
        });
        ctx.restore();
    }

    // 绘制食物（按类型取色），为大食物添加脉冲效果
    const fcfg = FOOD_TYPES[currentFood.type] || FOOD_TYPES.normal;
    if (currentFood.type === 'big') {
        // 脉冲大小：在 1.0~1.25 倍之间平滑变化
        const t = Date.now() * 0.006; // 脉冲速度
        const amp = 0.25; // 脉冲幅度（最大放大25%）
        const scale = 1 + amp * (0.5 + 0.5 * Math.sin(t));
        const size = gridSize * scale;
        const offset = (gridSize - size) / 2;
        ctx.save();
        ctx.fillStyle = fcfg.color;
        ctx.shadowColor = fcfg.color;
        ctx.shadowBlur = 10;
        ctx.fillRect(
            currentFood.x * gridSize + offset,
            currentFood.y * gridSize + offset,
            size,
            size
        );
        ctx.restore();
    } else {
        ctx.fillStyle = fcfg.color;
        ctx.fillRect(currentFood.x * gridSize, currentFood.y * gridSize, gridSize, gridSize);
    }

    // 绘制蛇
    ctx.fillStyle = '#4CAF50';
    snake.forEach((part, index) => {
        // 蛇头颜色不同
        if (index === 0) {
            ctx.fillStyle = '#388E3C';
        } else {
            ctx.fillStyle = '#4CAF50';
        }
        ctx.fillRect(part.x * gridSize, part.y * gridSize, gridSize, gridSize);
        
        // 绘制蛇身体边框
        ctx.strokeStyle = '#e0e0e0';
        ctx.strokeRect(part.x * gridSize, part.y * gridSize, gridSize, gridSize);
    });
}

// 绘制HUD（例如减速提示）
function drawHUD() {
    // 当前版本不显示减速HUD
}

// 生成新的食物位置
function generateFood() {
    function getRandomPosition() {
        // 0..tileCount-1范围
        return Math.floor(Math.random() * tileCount);
    }
    function getRandomType() {
        const r = Math.random();
        if (r < 0.7) return 'normal';
        if (r < 0.9) return 'big';
        return 'slow';
    }
    let nx, ny;
    do {
        nx = getRandomPosition();
        ny = getRandomPosition();
    } while (snake.some(part => part.x === nx && part.y === ny) || isObstacle(nx, ny));
    currentFood = { x: nx, y: ny, type: getRandomType() };
}

// 检查游戏是否结束
function isGameOver() {
    // 检查是否撞墙
    if (!wrapMode) {
        // 撞墙死亡模式：越界则结束
        if (
            snake[0].x < 0 ||
            snake[0].x >= tileCount ||
            snake[0].y < 0 ||
            snake[0].y >= tileCount
        ) {
            return true;
        }
    }
    // 撞到障碍物则结束
    if (isObstacle(snake[0].x, snake[0].y)) {
        return true;
    }
    
    // 检查是否撞到自己
    for (let i = 1; i < snake.length; i++) {
        if (snake[0].x === snake[i].x && snake[0].y === snake[i].y) {
            return true;
        }
    }
    
    return false;
}

// 结束游戏
function endGame() {
    gameRunning = false;
    finalScoreElement.textContent = score;
    // 明确同步顶部“本次分数”为当前最终分数，避免显示漂移
    if (scoreElement) scoreElement.textContent = score;
    lastScore = score;
    if (lastScoreElement) lastScoreElement.textContent = lastScore;
    gameOverElement.classList.remove('hidden');
}

// 重置游戏
function resetGame() {
    snake = [{ x: 5, y: 5 }];
    velocityX = 0;
    velocityY = 0;
    score = 0;
    foodsEaten = 0;
    // 根据配置重置速度与等级
    baseSpeed = gameConfig.initialBaseSpeed ?? 1;
    speedLevel = gameConfig.initialSpeedLevel ?? 1;
    scoreElement.textContent = score;
    if (speedSlider) speedSlider.value = baseSpeed;
    speedValue.textContent = getEffectiveSpeed();
    // 先生成障碍，再生成食物以避免占位冲突
    const defaultCount = Math.max(1, Math.floor(tileCount * tileCount * 0.04));
    const count = gameConfig.obstacleCount ?? defaultCount;
    generateObstacles(count);
    generateFood();
    gameOverElement.classList.add('hidden');
}

// 开始游戏
function startGame() {
    if (!gameRunning) {
        gameRunning = true;
        gamePaused = false;
        resetGame();
    }
}

// 暂停游戏
function togglePause() {
    if (gameRunning) {
        gamePaused = !gamePaused;
        if (gamePaused) {
            pauseMenuElement.classList.remove('hidden');
            pauseBtn.textContent = '继续';
        } else {
            pauseMenuElement.classList.add('hidden');
            pauseBtn.textContent = '暂停';
        }
    }
}

// 继续游戏
function continueGame() {
    if (gameRunning && gamePaused) {
        gamePaused = false;
        pauseMenuElement.classList.add('hidden');
        pauseBtn.textContent = '暂停';
    }
}

// 从暂停状态重新开始游戏
function restartFromPause() {
    pauseMenuElement.classList.add('hidden');
    resetGame();
    startGame();
}

// 键盘控制
let lastDirection = { x: 0, y: 0 };

// 键盘按下事件处理
function keyDown(event) {
    // 空格键：在不同状态下控制暂停/开始/重新开始
    if (event.key === ' ') {
        // 如果游戏结束弹窗可见，则重新开始一局
        const isGameOverVisible = gameOverElement && !gameOverElement.classList.contains('hidden');
        if (isGameOverVisible) {
            resetGame();
            startGame();
            return;
        }
        // 如果未开始，则开始游戏；否则切换暂停
        if (!gameRunning) {
            startGame();
        } else {
            togglePause();
        }
        return;
    }
    // 处理P键暂停/继续
    if (event.key === 'p' || event.key === 'P') {
        togglePause();
        return;
    }
    
    // 直接处理方向键输入
    if (event.key === 'ArrowUp' && lastDirection.y !== 1) {
        velocityX = 0;
        velocityY = -1;
        lastDirection = { x: 0, y: -1 };
    } else if (event.key === 'ArrowDown' && lastDirection.y !== -1) {
        velocityX = 0;
        velocityY = 1;
        lastDirection = { x: 0, y: 1 };
    } else if (event.key === 'ArrowLeft' && lastDirection.x !== 1) {
        velocityX = -1;
        velocityY = 0;
        lastDirection = { x: -1, y: 0 };
    } else if (event.key === 'ArrowRight' && lastDirection.x !== -1) {
        velocityX = 1;
        velocityY = 0;
        lastDirection = { x: 1, y: 0 };
    }
    
    // 如果游戏未开始且按下方向键，则自动开始游戏
    if (!gameRunning && (event.key === 'ArrowUp' || event.key === 'ArrowDown' || 
        event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
        startGame();
    }
}

// 键盘释放事件处理 - 不再需要
function keyUp(event) {
    // 不再需要处理键盘释放事件
}

// 处理键盘输入 - 不再需要
function handleKeyboardInput() {
    // 不再需要此函数，方向已在keyDown中直接设置
}

// 事件监听
document.addEventListener('keydown', keyDown);
document.addEventListener('keyup', keyUp);
startBtn.addEventListener('click', startGame);
pauseBtn.addEventListener('click', togglePause);
restartBtn.addEventListener('click', resetGame);
continueBtn.addEventListener('click', continueGame);
restartFromPauseBtn.addEventListener('click', restartFromPause);
playAgainBtn.addEventListener('click', () => {
    resetGame();
    startGame();
});
// 更新说明开关
if (toggleChangelogBtn && changelogElement) {
    toggleChangelogBtn.addEventListener('click', () => {
        const hidden = changelogElement.classList.toggle('hidden');
        changelogElement.setAttribute('aria-hidden', hidden ? 'true' : 'false');
        toggleChangelogBtn.textContent = hidden ? '游戏说明' : '关闭说明';
    });
}
// 说明弹窗右上角×关闭
if (changelogCloseBtn && changelogElement) {
    changelogCloseBtn.addEventListener('click', () => {
        changelogElement.classList.add('hidden');
        changelogElement.setAttribute('aria-hidden', 'true');
        if (toggleChangelogBtn) toggleChangelogBtn.textContent = '游戏说明';
    });
}
bindDirButton(btnUp, 'up');
bindDirButton(btnDown, 'down');
bindDirButton(btnLeft, 'left');
bindDirButton(btnRight, 'right');

// 边界模式开关
if (wrapToggle) {
    wrapToggle.addEventListener('change', () => {
        wrapMode = wrapToggle.checked;
    });
}

// 初始化
async function initConfig() {
    try {
        const res = await fetch(`config.json?v=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
            const cfg = await res.json();
            // 合并配置（仅覆盖存在的字段）
            gameConfig = { ...gameConfig, ...cfg };
        }
    } catch (e) {
        // 读取失败则使用默认配置
        console.warn('加载配置文件失败，使用默认配置', e);
    }
    // 应用配置到游戏参数与UI
    gridSize = gameConfig.gridSize ?? gridSize;
    tileCount = gameConfig.tileCount ?? tileCount;
    baseSpeed = gameConfig.initialBaseSpeed ?? baseSpeed;
    speedLevel = gameConfig.initialSpeedLevel ?? speedLevel;
    wrapMode = gameConfig.wrapModeDefault ?? wrapMode;
    // 调整画布尺寸以匹配格子设置
    canvas.width = tileCount * gridSize;
    canvas.height = tileCount * gridSize;
    // 同步UI控件
    if (speedSlider) {
        speedSlider.min = 1;
        speedSlider.max = gameConfig.speedLevelMax ?? 7;
        speedSlider.value = baseSpeed;
    }
    if (wrapToggle) {
        wrapToggle.checked = !!wrapMode;
    }
    speedValue.textContent = getEffectiveSpeed();
}

(async function bootstrap() {
    await initConfig();
    // 初始时生成障碍与食物
    const defaultCount = Math.max(1, Math.floor(tileCount * tileCount * 0.04));
    const count = gameConfig.obstacleCount ?? defaultCount;
    generateObstacles(count);
    generateFood();
    gameLoop();
})();
// 移动端方向按钮控制
function setDirectionFromButton(dir) {
    if (gamePaused) return; // 暂停时不响应
    if (dir === 'up' && lastDirection.y !== 1) {
        velocityX = 0; velocityY = -1; lastDirection = { x: 0, y: -1 };
    } else if (dir === 'down' && lastDirection.y !== -1) {
        velocityX = 0; velocityY = 1; lastDirection = { x: 0, y: 1 };
    } else if (dir === 'left' && lastDirection.x !== 1) {
        velocityX = -1; velocityY = 0; lastDirection = { x: -1, y: 0 };
    } else if (dir === 'right' && lastDirection.x !== -1) {
        velocityX = 1; velocityY = 0; lastDirection = { x: 1, y: 0 };
    }
    if (!gameRunning) startGame();
}

function bindDirButton(el, dir) {
    if (!el) return;
    const handler = (e) => { e.preventDefault(); setDirectionFromButton(dir); };
    el.addEventListener('click', handler);
    el.addEventListener('touchstart', handler, { passive: false });
}