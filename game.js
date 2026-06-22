// إعداد Babylon.js
const canvas = document.getElementById('renderCanvas');
const engine = new BABYLON.Engine(canvas, true);

// متغيرات اللعبة
let scene;
let camera;
let player;
let enemies = [];
let projectiles = [];
let score = 0;
let health = 100;
let keys = {};
let mouseDown = false;

// إنشاء المشهد
function createScene() {
    scene = new BABYLON.Scene(engine);
    scene.collisionsEnabled = true;
    scene.gravity = new BABYLON.Vector3(0, -0.9, 0);
    scene.fogMode = BABYLON.Scene.FOGMODE_EXP;
    scene.fogDensity = 0.01;
    scene.fogColor = BABYLON.Color3.FromHexString("#87CEEB");

    // الكاميرا - منظور من الشخص الأول
    camera = new BABYLON.UniversalCamera("camera", new BABYLON.Vector3(0, 2, 0));
    camera.attachControl(canvas, true);
    camera.inertia = 0.7;
    camera.angularSensibility = 1000;
    camera.speed = 0;
    camera.checkCollisions = true;

    // الإضاءة
    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0));
    light.intensity = 0.8;

    const sunLight = new BABYLON.PointLight("sunLight", new BABYLON.Vector3(50, 100, 50));
    sunLight.intensity = 0.7;
    sunLight.range = 500;

    // السماء
    const skybox = BABYLON.MeshBuilder.CreateBox("skybox", { size: 1000 }, scene);
    const skyboxMaterial = new BABYLON.StandardMaterial("skybox", scene);
    skyboxMaterial.emissiveColor = BABYLON.Color3.FromHexString("#87CEEB");
    skyboxMaterial.backFaceCulling = false;
    skybox.material = skyboxMaterial;

    // الأرضية
    const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 200, height: 200 }, scene);
    const groundMaterial = new BABYLON.StandardMaterial("groundMat", scene);
    groundMaterial.diffuse = BABYLON.Color3.FromHexString("#228B22");
    ground.material = groundMaterial;
    ground.checkCollisions = true;

    // إنشاء الكائن الأساسي (اللاعب)
    createPlayer();

    // إنشاء الأعداء
    for (let i = 0; i < 5; i++) {
        createEnemy();
    }

    return scene;
}

// إنشاء اللاعب
function createPlayer() {
    player = BABYLON.MeshBuilder.CreateSphere("player", { diameter: 1 }, scene);
    player.position = new BABYLON.Vector3(0, 2, 0);
    player.checkCollisions = true;

    const playerMaterial = new BABYLON.StandardMaterial("playerMat", scene);
    playerMaterial.diffuse = BABYLON.Color3.FromHexString("#FF6347");
    player.material = playerMaterial;

    player.velocity = new BABYLON.Vector3(0, 0, 0);
    player.speed = 0.15;
    player.jumpPower = 0.25;
    player.isGrounded = false;
}

// إنشاء عدو
function createEnemy() {
    const enemy = BABYLON.MeshBuilder.CreateBox("enemy", { size: 1 }, scene);
    
    // موضع عشوائي
    const angle = Math.random() * Math.PI * 2;
    const distance = 20 + Math.random() * 50;
    enemy.position = new BABYLON.Vector3(
        Math.cos(angle) * distance,
        1,
        Math.sin(angle) * distance
    );

    const enemyMaterial = new BABYLON.StandardMaterial("enemyMat" + Math.random(), scene);
    enemyMaterial.diffuse = BABYLON.Color3.FromHexString("#4169E1");
    enemy.material = enemyMaterial;

    enemy.checkCollisions = true;
    enemy.health = 3;
    enemy.moveSpeed = 0.05;
    enemy.attackCooldown = 0;

    enemies.push(enemy);
}

// تحديث منطق اللعبة
function updateGame() {
    // حركة اللاعب
    let moveDirection = new BABYLON.Vector3(0, 0, 0);

    if (keys['w'] || keys['ArrowUp']) moveDirection.z += 1;
    if (keys['s'] || keys['ArrowDown']) moveDirection.z -= 1;
    if (keys['a'] || keys['ArrowLeft']) moveDirection.x -= 1;
    if (keys['d'] || keys['ArrowRight']) moveDirection.x += 1;

    if (moveDirection.length() > 0) {
        moveDirection = BABYLON.Vector3.Normalize(moveDirection);
        
        // تدوير حسب اتجاه الكاميرا
        const forward = BABYLON.Vector3.Forward();
        const right = BABYLON.Vector3.Right();
        
        const cameraForward = BABYLON.Vector3.TransformCoordinates(
            forward,
            BABYLON.Matrix.RotationY(camera.rotation.y)
        );
        const cameraRight = BABYLON.Vector3.TransformCoordinates(
            right,
            BABYLON.Matrix.RotationY(camera.rotation.y)
        );

        player.velocity.x = (moveDirection.z * cameraForward.x + moveDirection.x * cameraRight.x) * player.speed;
        player.velocity.z = (moveDirection.z * cameraForward.z + moveDirection.x * cameraRight.z) * player.speed;
    } else {
        player.velocity.x *= 0.9;
        player.velocity.z *= 0.9;
    }

    // الجاذبية والقفز
    if (player.position.y <= 2) {
        player.isGrounded = true;
    } else {
        player.isGrounded = false;
    }

    if (keys[' '] && player.isGrounded) {
        player.velocity.y = player.jumpPower;
        player.isGrounded = false;
    }

    player.velocity.y -= 0.01; // الجاذبية

    player.position.addInPlace(player.velocity);

    // منع السقوط من الخريطة
    if (player.position.y < -10) {
        player.position = new BABYLON.Vector3(0, 2, 0);
        health -= 10;
    }

    // تحديث الأعداء
    enemies.forEach((enemy, index) => {
        if (!enemy.alive) return;

        // حركة العدو نحو اللاعب
        const direction = BABYLON.Vector3.Subtract(player.position, enemy.position);
        const distance = BABYLON.Vector3.Distance(player.position, enemy.position);

        if (distance > 1) {
            direction.normalize();
            enemy.position.addInPlace(direction.scale(enemy.moveSpeed));
        }

        // هجوم العدو
        enemy.attackCooldown--;
        if (distance < 3 && enemy.attackCooldown < 0) {
            health -= 5;
            enemy.attackCooldown = 30;
        }

        // إعادة تموضع العدو إذا ابتعد جداً
        if (distance > 100) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 20 + Math.random() * 30;
            enemy.position = new BABYLON.Vector3(
                player.position.x + Math.cos(angle) * dist,
                1,
                player.position.z + Math.sin(angle) * dist
            );
        }
    });

    // تحديث المقذوفات
    projectiles.forEach((projectile, index) => {
        projectile.position.addInPlace(projectile.velocity);

        // التحقق من الاصطدام بالأعداء
        enemies.forEach((enemy, enemyIndex) => {
            if (!enemy.alive) return;
            
            const distance = BABYLON.Vector3.Distance(projectile.position, enemy.position);
            if (distance < 1.5) {
                enemy.health--;
                if (enemy.health <= 0) {
                    enemy.dispose();
                    enemy.alive = false;
                    score += 100;
                    createEnemy(); // إنشاء عدو جديد
                }
                projectile.dispose();
                projectiles.splice(index, 1);
            }
        });

        // حذف المقذوفة إذا ابتعدت جداً
        if (BABYLON.Vector3.Distance(projectile.position, player.position) > 200) {
            projectile.dispose();
            projectiles.splice(index, 1);
        }
    });

    // تحديث الكاميرا
    camera.position.copyFrom(player.position.add(new BABYLON.Vector3(0, 0.5, 0)));

    // تحديث الصحة
    if (health <= 0) {
        health = 0;
        resetGame();
    }

    // تحديث UI
    document.getElementById('score').textContent = score;
    document.getElementById('health').textContent = Math.max(0, Math.floor(health));
    document.getElementById('fps').textContent = Math.round(engine.getFps());
}

// إطلاق المقذوفة
function fireProjectile() {
    const projectile = BABYLON.MeshBuilder.CreateSphere("projectile", { diameter: 0.3 }, scene);
    projectile.position = player.position.clone();

    const projectileMaterial = new BABYLON.StandardMaterial("projMat" + Math.random(), scene);
    projectileMaterial.emissiveColor = BABYLON.Color3.FromHexString("#FFD700");
    projectile.material = projectileMaterial;

    // اتجاه الكاميرا
    const forward = BABYLON.Vector3.Forward();
    const transformedForward = BABYLON.Vector3.TransformCoordinates(
        forward,
        BABYLON.Matrix.RotationY(camera.rotation.y)
    );

    projectile.velocity = transformedForward.scale(0.5);
    projectiles.push(projectile);
}

// إعادة تعيين اللعبة
function resetGame() {
    score = 0;
    health = 100;
    player.position = new BABYLON.Vector3(0, 2, 0);
    player.velocity = new BABYLON.Vector3(0, 0, 0);
}

// معالجات لوحة المفاتيح والماوس
document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

canvas.addEventListener('click', () => {
    fireProjectile();
});

// تشغيل اللعبة
scene = createScene();

engine.runRenderLoop(() => {
    updateGame();
    scene.render();
});

// معالجة تغيير حجم النافذة
window.addEventListener('resize', () => {
    engine.resize();
});