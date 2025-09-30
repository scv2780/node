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