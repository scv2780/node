// app_register.js
const express = require("express");
const oracledb = require("oracledb");
const cors = require('cors');

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

const dbConfig = {
  user: "hr",
  password: "hr",
  connectString: "localhost:1521/xe",
  poolMin: 10,
  poolMax: 10,
  poolIncrement: 0,
  poolAlias: "APP_POOL", //풀이름 지정
}

// oracle 연결을 위한 pool. [메모리를 담아놓는 곳]
async function initialize() {
  try {
    await oracledb.createPool(dbConfig);
    console.log("연결 성공");
  } catch (err) {
    // 예외 발생
    console.log("연결 실패");
    process.exit(1); // 연결 실패 시 서버 종료 
  }
}

const app = express(); // 웹서버 역활을 하는 인스턴스
app.use(cors()); // 서버와 클라가 반드시 동일한 리소스를 가져고 있어야함
app.use(express.json());

// nodemon test...

app.get("/", (req, res) => {
  res.send('Root 페이지가 요청');
});

//회원 등록.
app.post('/member_info', async (req, res) => {
  console.log(req.body);

  let connection;
  try {
    //4. 풀 이름(APP_POOL)으로 커넥션 가져오기
    connection = await oracledb.getConnection(dbConfig.poolAlias);
    //SQL 쿼리 실행

    const result = await connection.execute(
      `INSERT INTO member_info (m_num, m_id, m_pw, nickname, m_name, m_tel, m_email)
       VALUES (member_seq.NEXTVAL, :mId, :mPw, :mNick, :mName, :mTel, :mMail)`, {
        mId: req.body.mId,
        mPw: req.body.mPw,
        mNick: req.body.mNick,
        mName: req.body.mName,
        mTel: req.body.mTel,
        mMail: req.body.mMail
      }, {
        autoCommit: true
      } // commit 자동 처리
    );
    //조회된 데이터를json형식으로 응답
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({
      error: "데이터 조회 중 오류가 발생했습니다.",
      detail: err.message,
    })
  } finally {
    if (connection) {
      try {
        //커넥션 반환
        await connection.close();
        // console.log("connection closed.")//요청이 많을 떈 이 로그르 제거
      } catch (err) {
        console.log("X Error closing connection:", err);
      }
    }
  }
});

app.post('/login', async (req, res) => {
  const {
    loginId,
    loginPw
  } = req.body;
  console.log("로그인 시도", loginId);

  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig.poolAlias);

    const result = await connection.execute(
      // 먼저 아이디를 기준으로 사용자 정보 조회
      `SELECT m_pw, nickname 
       FROM member_info 
       WHERE m_id = :mId`, {
        mId: loginId
      }
    );
    if (result.rows.length === 0) {
      // 조회된 사용자가 없으면 401 에러 응답
      return res.status(401).json({
        message: "존재하지 않는 아이디입니다."
      });
    }

    const user = result.rows[0];
    const userPw = user.M_PW; // DB에 저장된 비밀번호 (오라클은 대문자로 반환)
    const userNick = user.NICKNAME; // DB에 저장된 닉네임

    // DB 비밀번호와 사용자가 입력한 비밀번호 비교
    if (userPw === loginPw) {
      // 비밀번호 일치: 성공 응답
      res.status(200).json({
        message: "로그인 성공",
        nickname: userNick
      });
    } else {
      // 비밀번호 불일치: 401 에러 응답
      res.status(401).json({
        message: "비밀번호가 일치하지 않습니다."
      });
    }
  } catch (err) {
    res.status(500).json({
      error: "로그인 처리 중 오류가 발생했습니다.",
      detail: err.message
    });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.log("X error closing connection:", err);
      }
    }
  }
});

const port = 3000;

async function startServer() {
  await initialize();
  app.listen(port, () => {
    console.log(`Server is listening on http://localhost:${port}`);
  }); //포트 3000을 활용해 서버 실행
}
startServer();