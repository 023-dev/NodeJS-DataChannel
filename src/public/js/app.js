const socket = io();

const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const cameraSelect = document.getElementById("cameras")
const call = document.getElementById("call")
const header = document.getElementById("title")
const room = document.getElementById("room")
room.hidden = true
call.hidden = true
header.hidden = false
let myStream;
let muted = false;
let cameraOff = false;
let roomName
let myPeerConnection
let myDataChannel
//chat
//video list code
async function getCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(device => device.kind =="videoinput");
        const currentCamera = myStream.getVideoTracks()[0];
        cameras.forEach(camera => {
            const option = document.createElement("option");
            option.value = camera.deviceId;
            option.innerText = camera.label;
            if(currentCamera.label = camera.label) {
                option.selected = true;
            }
            cameraSelect.appendChild(option);
        })
    } catch(err) {
        console.log(err);
    }
}

//getCameras 에서 선택한 장치로 접근 및 스트림
async function getMedia(deviceId) {
    const initialConstraints = {
        audio : true,
        video : { facingMode : "user"},
    };
    const cameraConstraints = {
        audio : true,
        video : {deviceId : { exact : deviceId } },
    }
    try {
        myStream = await navigator.mediaDevices.getUserMedia(
        // use the stream 
        deviceId ? cameraConstraints : initialConstraints);
        myFace.srcObject = myStream;
        if (!deviceId) {
        await getCameras();
        }
        //console.log('videoTracks',myStream.getVideoTracks())//비디오 트랙 테스트
    } catch(err) {
        // handle the error
        console.log(err);
    };

}


//사용중인 마이크 사용 해제 기능
function handleMuteClick() {
    myStream.getAudioTracks().forEach((track) => (track.enabled = !track.enabled));
    if(!muted){
        muteBtn.innerText = "음소거 해제";
    } else {
        muteBtn.innerText = "음소거 하기";
    }
    muted = !muted;
};
//사용중인 카메라 사용 해제 기능
function handleCameraClick() {
    myStream.getVideoTracks().forEach((track) => (track.enabled = !track.enabled))
    if(!cameraOff){
        cameraBtn.innerText = "카메라 끄기";
    } else {
        cameraBtn.innerText = "카메라 켜기";
    }
    cameraOff = !cameraOff;
};

//다른 장치로 접근 시도 시, getMedia 함수 재실행
async function handleCameraChange() {
    await getMedia(cameraSelect.value)
    // 다른 peer 에게도 장치 변경 적용하기
    
    if(myPeerConnection){
        const videoTrack = myStream.getVideoTracks()[0]
        //The sender's role is to control media stream track
        //send not only video device information, but also audio device information
        const videoSender = myPeerConnection.getSender().find(sender => sender.track.kind == "video")
        videoSender.replaceTrack(videoTrack)

    }
}

//이벤트 코드
muteBtn.addEventListener("click", handleMuteClick)
cameraBtn.addEventListener("click", handleCameraClick)
cameraSelect.addEventListener("input", handleCameraChange)

//welcome 폼 (방에 입장)
const welcome = document.getElementById("welcome")
const welcomeForm = welcome.querySelector("form")

//방에 입장 시, getMedia 함수를 실행하고, makeConnection함수를 실행함으로 방에 유저들과 오디오 및 비디오 연결 시도(스트림)
async function initCall() {
    room.querySelector("h3").innerText = `${roomName}`
    welcome.hidden = true
    call.hidden = false
    room.hidden = false
    header.hidden = true
    await getMedia()
    makeConnection()
}

//방 이름을 서버에 넘겨서 join_room로 해당 방으로 입장 후 startMedia 함수 실행
async function handleWelcomeSubmit(event) {
    event.preventDefault();
    const input = welcomeForm.querySelector("input")
    await initCall()
    socket.emit("join_room", input.value)
    roomName = input.value
    input.value = ""
}

//방 이름을 입력 후, 입장 버튼으로 submit을 감사하여 handleWelcomeSubmit 함수 실행
welcomeForm.addEventListener("submit", handleWelcomeSubmit);

//socket code
//welcome 이벤트 발생 시, offer기 생성되는 함수 -> 서버로 offer, roomName 값 emit 
//running at peer A
socket.on("welcome", async () => {
    myDataChannel = myPeerConnection.createDataChannel("chat");//"chat" is name of channel. Create a Data Channel on myPeerConnection using by createDataChannel.
    myDataChannel.addEventListener("message", (event) => { //Create event listener of channel
        console.log(event.data)
        addMessage(`나 : ${event.data}`)
    //and event data -> console log
    })
    console.log("made data channel");
    const offer = await myPeerConnection.createOffer()
    myPeerConnection.setLocalDescription(offer)
    console.log("sent the offer")
    socket.emit("offer", offer, roomName)
})

//welcome => setRemoteDescription / peer A => peer B 
//just it's code running at peer B
socket.on("offer", async(offer) => {
    myPeerConnection.addEventListener("datachannel", (event) => {
        myDataChannel = event.channel;
        myDataChannel.addEventListener("message", (event) => {
            console.log(event.data)
        })
    })

    console.log("recive the offer")
    myPeerConnection.setRemoteDescription(offer)
    const answer = await myPeerConnection.createAnswer()
    myPeerConnection.setLocalDescription(answer)
    socket.emit("answer", answer, roomName)
    console.log("sent the answer")
})

//peer B => peer A 
// executes when a answer is recived from peer B 
socket.on("answer", answer => {
    console.log("received the answer")
    myPeerConnection.setRemoteDescription(answer)
})

socket.on("ice", ice  => {
    console.log("recived candidate")
    myPeerConnection.addIceCandidate(ice)
})

// RTC Code
//방에 입장 시 실행됨.
//오디오 및 비디오 장치들을 수집 후, 해당 장치들로 연결 시도할 수 있게 구성
function makeConnection(){
    myPeerConnection = new RTCPeerConnection({
        //use googel's public stun server
        iceServers : [
        {   //just send my public ip
            urls : [
            "stun:stun.l.google.com:19302",
            "stun:stun1.l.google.com:19032",
            "stun:stun2.l.google.com:19302",
            "stun:stun3.l.google.com:19302",
            "stun:stun4.l.google.com:19302",
            ],
        },
    ],
    });//declare new producer function 
    myPeerConnection.addEventListener("icecandidate", handleIce);
    myPeerConnection.addEventListener("addstream", handleAddStream)
    myStream.getTracks().forEach(track => myPeerConnection.addTrack(track, myStream));
}

function handleIce(data){
    console.log("sent candidate")
    socket.emit("ice", data.candidate, roomName)
}

function handleAddStream(data){
    const peerFace = document.getElementById("peerFace");
    peerFace.srcObject = data.stream;
}

room.querySelector("#msg button").addEventListener("click", (event)=> {
    event.preventDefault();
    const value = room.querySelector("#msg input").value
    myDataChannel.send(value)
    const ul = room.querySelector("ul")
    const li = room.querySelector("li")
    li.innerText = value
    ul.appendChild(li)
    console.log(value)
    }
)
