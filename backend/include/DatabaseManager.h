#pragma once
#include <mysql_driver.h>
#include <mysql_connection.h>
#include <cppconn/statement.h>
#include <cppconn/prepared_statement.h>
#include <cppconn/resultset.h>
#include <cppconn/exception.h>
#include <iostream>
#include <string>
#include <memory>
#include <mutex>

class DatabaseManager {
private:
    sql::mysql::MySQL_Driver* driver;
    std::unique_ptr<sql::Connection> connection;
    std::recursive_mutex db_mutex;

    DatabaseManager();

    void connect();

public:
    static DatabaseManager& getInstance();

    // 基础功能
    bool verifyLogin(const std::string& cardNumber, const std::string& password);
    std::string getUserInfo(const std::string& cardNumber);
    double getBalance(const std::string& cardNumber);
    bool deposit(const std::string& cardNumber, double amount);
    bool withdraw(const std::string& cardNumber, double amount);
    std::string getTransactionHistory(const std::string& cardNumber);
    bool isCardNumberExists(const std::string& cardNumber);
    bool createAccount(const std::string& name, const std::string& idCard,
                      const std::string& phone, const std::string& address,
                      const std::string& cardNumber, const std::string& password,
                      double initialDeposit);
    bool isConnected();

    // 进阶功能
    std::string getUserName(const std::string& card_number);
    bool transfer(const std::string& from_card, const std::string& to_card, double amount, const std::string& message, bool is_anonymous);
    std::string getUserMessages(const std::string& card_number);
    bool markMessageRead(int message_id);
    bool sendSystemMessage(const std::string& to_card, const std::string& title, const std::string& content);

    // 新增：更新用户信息
    bool updateUserInfo(const std::string& cardNumber, const std::string& name, const std::string& idCard, const std::string& phone, const std::string& address);

    bool verifyIdentity(const std::string& cardNumber, const std::string& name, const std::string& phone);
    bool updatePassword(const std::string& cardNumber, const std::string& newPassword);

    DatabaseManager(const DatabaseManager&) = delete;
    DatabaseManager& operator=(const DatabaseManager&) = delete;

    ~DatabaseManager();
};