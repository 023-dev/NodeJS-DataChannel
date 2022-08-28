import http from "http";
import SocketIO from "socket.io";
import express from "express";

const app = express();
app.set("view engine", "pug");//set view engine => pug
app.set("views", __dirname + "/views");//set view files'path => project dir path + /views
app.use("/public", express.static(__dirname + "/public"));// root path에서 public의 하위에서 수행
app.get("/", (_, res) => res.render("home"));//get home.pug file when rendering
app.get("/*", (_, res) => res.redirect("/"));
const httpServer = http.createServer(app);//설정대로 httpServer 생성 구문
const wsServer = SocketIO(httpServer);//httpServer을 SocketIO로 webSocket 구현 
wsServer.on("connection", (socket) => { //connection event 발생 시, 수행
  socket.on("join_room", (roomName) => { //join_room을 받으면 실행, 방의 이름인 roomName과 무언가 실행을 할 done을 바인딩
    socket.join(roomName); //해당 방의 이름으로 접속 또는 생성
    socket.to(roomName).emit("welcome");
  });
  socket.on("offer", (offer, roomName) => {
    socket.to(roomName).emit("offer", offer);
  });
  socket.on("answer", (answer, roomName) => {
    socket.to(roomName).emit("answer", answer)
  });
  socket.on("ice", (ice, roomName) =>{
    socket.to(roomName).emit("ice", ice)
  })
});

const handleListen = () => console.log(`Listening on http://localhost:3000`);
httpServer.listen(3000, handleListen);