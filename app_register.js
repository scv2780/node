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

// 로그인
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
      `SELECT m_pw, nickname, m_num
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
    const userNum = user.M_NUM;

    // DB 비밀번호와 사용자가 입력한 비밀번호 비교
    if (userPw === loginPw) {
      // 비밀번호 일치: 성공 응답
      res.status(200).json({
        message: "로그인 성공",
        nickname: userNick,
        m_num: userNum
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

// 게시물 목록
app.post('/bulletin', async (req, res) => {
  const {
    page = 1, limit = 10
  } = req.body; // 기본값: 1페이지, 10개
  // console.log(req.body);

  let connection;
  try {
    connection = await oracledb.getConnection(dbConfig.poolAlias);

    const result = await connection.execute(
      `SELECT *
       FROM (
         SELECT b.b_num, m.m_num, m.nickname, b.b_title, b.b_write, b.b_date,
                ROW_NUMBER() OVER (ORDER BY b.b_date DESC) rn
         FROM bulletin b
         JOIN member_info m ON b.m_num = m.m_num
       )
       WHERE rn BETWEEN :startRow AND :endRow`, {
        startRow: (page - 1) * limit + 1,
        endRow: page * limit
      }
    );
    console.log("게시물 조회 결과", result.rows);
    res.status(200).json(result.rows);
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
})

// 게시글 등록
app.post('/write', async (req, res) => {
  // console.log("게시글 작성 요청 데이터", req.body);

  let connection;
  try {
    //4. 풀 이름(APP_POOL)으로 커넥션 가져오기
    connection = await oracledb.getConnection(dbConfig.poolAlias);
    //SQL 쿼리 실행
    const mNumValue = parseInt(req.body.m_num, 10); // m_num이 문자열로 넘어와서 정수로 변환

    const result = await connection.execute(
      `INSERT INTO bulletin (b_num, m_num, b_title, b_write, b_date)
       VALUES (bulletin_seq.NEXTVAL, :mNum, :title, :write, SYSDATE)`, {
        mNum: mNumValue,
        title: req.body.title,
        write: req.body.write
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

// 게시글 상세 조회
app.post("/postDetail", async (req, res) => {
  const {
    b_num
  } = req.body;
  let connection;

  try {
    connection = await oracledb.getConnection(dbConfig.poolAlias);

    const result = await connection.execute(
      `SELECT b.b_num, b.b_title, b.b_write, b.b_date, m.nickname, m.m_num,
              (SELECT COUNT(*) FROM likes l WHERE l.b_num = b.b_num) AS like_count,
              (SELECT COUNT(*) FROM comments c WHERE c.b_num = b.b_num) AS comment_count
       FROM bulletin b
       JOIN member_info m
       ON b.m_num = m.m_num
       WHERE b.b_num = :b_num`, {
        b_num
      }
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "게시글을 찾을 수 없습니다."
      });
    }

    res.json(result.rows[0]); // 게시글 1개 반환
  } catch (err) {
    res.status(500).json({
      error: "게시글 조회 중 오류",
      detail: err.message
    });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {}
    }
  }
});

// 좋아요 토글
app.post("/toggleLike", async (req, res) => {
  const {
    b_num,
    m_num
  } = req.body;
  let connection;

  try {
    connection = await oracledb.getConnection(dbConfig.poolAlias);

    // 이미 좋아요 했는지 확인
    const check = await connection.execute(
      `SELECT * FROM likes WHERE b_num = :b_num AND m_num = :m_num`, {
        b_num,
        m_num
      }
    );

    if (check.rows.length > 0) {
      // 있으면 삭제
      await connection.execute(
        `DELETE FROM likes WHERE b_num = :b_num AND m_num = :m_num`, {
          b_num,
          m_num
        }, {
          autoCommit: true
        }
      );
      res.json({
        status: "unliked"
      });
    } else {
      // 없으면 추가
      await connection.execute(
        `INSERT INTO likes (l_num, b_num, m_num)
         VALUES (likes_seq.NEXTVAL, :b_num, :m_num)`, {
          b_num,
          m_num
        }, {
          autoCommit: true
        }
      );
      res.json({
        status: "liked"
      });
    }
  } catch (err) {
    res.status(500).json({
      error: "좋아요 처리 오류",
      detail: err.message
    });
  } finally {
    if (connection) await connection.close();
  }
});

// 댓글 목록 불러오기
app.post("/comments", async (req, res) => {
  const {
    postId,
    page = 1,
    limit = 5
  } = req.body;
  let connection;

  try {
    connection = await oracledb.getConnection(dbConfig.poolAlias);

    const result = await connection.execute(
      `SELECT *
       FROM (
         SELECT c.c_num, c.c_write, c.c_date, m.nickname,
                ROW_NUMBER() OVER (ORDER BY c.c_date DESC) rn
         FROM comments c
         JOIN member_info m ON c.m_num = m.m_num
         WHERE c.b_num = :b_num
       )
       WHERE rn BETWEEN :startRow AND :endRow`, {
        b_num: postId,
        startRow: (page - 1) * limit + 1,
        endRow: page * limit
      }
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({
      error: "댓글 조회 중 오류",
      detail: err.message,
    });
  } finally {
    if (connection) await connection.close();
  }
});

// 댓글 작성
app.post("/addComment", async (req, res) => {
  const {
    postId,
    m_num,
    content
  } = req.body;
  let connection;

  try {
    connection = await oracledb.getConnection(dbConfig.poolAlias);

    // 숫자 변환 (중요!)
    const bNumVal = parseInt(postId, 10);
    const mNumVal = parseInt(m_num, 10);

    await connection.execute(
      `INSERT INTO comments (c_num, b_num, m_num, c_write, c_date)
       VALUES (comments_seq.NEXTVAL, :b_num, :m_num, :c_write, SYSDATE)`, {
        b_num: bNumVal,
        m_num: mNumVal,
        c_write: content
      }, {
        autoCommit: true
      }
    );

    // 최신 댓글 1개만 다시 조회
    const result = await connection.execute(
      `SELECT c.c_num, c.c_write, c.c_date, m.nickname
       FROM comments c
       JOIN member_info m ON c.m_num = m.m_num
       WHERE c.b_num = :b_num
       ORDER BY c.c_date DESC FETCH FIRST 1 ROWS ONLY`, {
        b_num: bNumVal
      }
    );

    if (result.rows.length === 0) {
      return res.status(500).json({
        error: "댓글 조회 실패"
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({
      error: "댓글 등록 중 오류",
      detail: err.message
    });
  } finally {
    if (connection) await connection.close();
  }
});

/////////////////////////////
const port = 3000;

async function startServer() {
  await initialize();
  app.listen(port, () => {
    console.log(`Server is listening on http://localhost:${port}`);
  }); //포트 3000을 활용해 서버 실행
}
startServer();