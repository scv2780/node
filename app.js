const express = require("express"); //require 외부 모듈 가져오는거
const oracledb = require("oracledb");
const cors = require('cors');

//1. 결과 형식을 객체로 설정(선택 사항이지만 권장)
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

const dbConfig = {
  user: "scott",
  password: "tiger",
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
    //예외 발생
    console.log("연결 실패");
    process.exit(1); //연결 실패 시 서버 종료 
  }
}
//  initialize();

const app = express(); //웹서버 역활을 하는 인스턴스
app.use(cors()); //서버와 클라가 반드시 동일한 리소스를 가져고 있어야함
app.use(express.json());


//nodemon test...

app.get("/", (req, res) => {
  res.send('Root 페이지가 요청');
});

//사원 등록.
app.post('/emp', async (req, res) => {
  console.log(req.body);

  let connection;
  try {
    //4. 풀 이름(APP_POOL)으로 커넥션 가져오기
    connection = await oracledb.getConnection(dbConfig.poolAlias);
    //SQL 쿼리 실행

    const result = await connection.execute(
      `INSERT INTO EMP(empno, ename, job ,hiredate, deptno)
    VALUES 
    (${req.body.eno},'${req.body.ename}','${req.body.job}',
    to_date('${req.body.hd}','rrrr-mm-dd'),${req.body.deptno} )`
    );
    console.log(result);
    await connection.commit();
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

})


//사원 삭제
//eno가 사용자가 보내는 값
app.get('/emp/:eno', async (req, res) => {
  console.log(req.params.eno);
  let empno = req.params.eno;
  let connection;
  try {
    //4. 풀 이름(APP_POOL)으로 커넥션 가져오기
    connection = await oracledb.getConnection(dbConfig.poolAlias);
    //SQL 쿼리 실행
    const result = await connection.execute(`DELETE FROM emp WHERE empno = ${empno}`);
    console.log(result);
    await connection.commit();
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

})

//사원 목록
app.get("/emp/:ename/:job/:deptno", async (req, res) => {
  console.log(req.params);
  const ename = req.params.ename;
  const job = req.params.job;
  const deptno = req.params.deptno;
  let connection;
  try {
    //4. 풀 이름(APP_POOL)으로 커넥션 가져오기
    connection = await oracledb.getConnection(dbConfig.poolAlias);
    const sql = `SELECT *
                FROM emp_dept_v
                WHERE ename = DECODE('${ename}', 'ALL', ename, '${ename}')
                AND job = DECODE('${job}', 'ALL', job, '${job}')
                AND deptno = DECODE('${deptno}', -1, deptno, ${deptno})`;
    console.log(sql);

    //SQL 쿼리 실행
    const result = await connection.execute(sql);
    console.log(result);
    //조회된 데이터를json형식으로 응답
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
const port = 3000;

async function startServer() {
  await initialize();
  app.listen(port, () => {
    console.log(`Server is listening on http://localhost:${port}`);
  }); //포트 3000을 활용해 서버 실행
}
startServer();