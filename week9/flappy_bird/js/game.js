const canvas = document.getElementById("gameCanvas")
const ctx = canvas.getContext("2d")

const scoreText = document.getElementById("score")
const startText = document.getElementById("start")

const birdImg = new Image()
birdImg.src = "img/bird.png"

const pipeTop = new Image()
pipeTop.src = "img/pipe-top.png"

const pipeBottom = new Image()
pipeBottom.src = "img/pipe-bottom.png"

let bird = {
x:80,
y:200,
width:40,
height:30,
gravity:0.6,
lift:-10,
velocity:0
}

let pipes = []

let score = 0
let running = false

function spawnPipe(){

const gap = 160
const topHeight = Math.random() * 250 + 50

pipes.push({
x:400,
top:topHeight,
bottom:topHeight + gap,
width:60,
passed:false
})
}

function reset(){

bird.y = 200
bird.velocity = 0

pipes = []
score = 0

scoreText.innerText = 0
}

function flap(){
bird.velocity = bird.lift
}

function update(){

if(!running) return

bird.velocity += bird.gravity
bird.y += bird.velocity

if(bird.y + bird.height >= canvas.height){
running = false
startText.innerText = "Game Over - Click to Restart"
}

for(let i=0;i<pipes.length;i++){ let p=pipes[i] p.x -=2 if(!p.passed && p.x + p.width < bird.x){ p.passed=true score++
    scoreText.innerText=score } if( bird.x < p.x + p.width && bird.x + bird.width> p.x &&
    (bird.y < p.top || bird.y + bird.height> p.bottom)
        ){
        running = false
        startText.innerText = "Game Over - Click to Restart"
        }
        }

        pipes = pipes.filter(p => p.x + p.width > 0)

        if(pipes.length == 0 || pipes[pipes.length-1].x < 220){ spawnPipe() } } function draw(){
            ctx.clearRect(0,0,canvas.width,canvas.height) ctx.drawImage( birdImg, bird.x, bird.y, bird.width,
            bird.height ) pipes.forEach(p=> {

            ctx.drawImage(
            pipeTop,
            p.x,
            0,
            p.width,
            p.top
            )

            ctx.drawImage(
            pipeBottom,
            p.x,
            p.bottom,
            p.width,
            canvas.height - p.bottom
            )
            })
            }

            function loop(){

            update()
            draw()

            requestAnimationFrame(loop)
            }

            loop()

            document.addEventListener("keydown", e => {

            if(e.code === "Space"){

            if(!running){
            reset()
            running = true
            startText.innerText = ""
            }

            flap()
            }
            })

            document.addEventListener("click", () => {

            if(!running){
            reset()
            running = true
            startText.innerText = ""
            }

            flap()
            })