#include "../include/DatabaseManager.h"
#include <sstream>
#include <iomanip>

std::string escapeJson(const std::string& s) {
    std::ostringstream o;
    for (auto c : s) {
        if (c == '"') o << "\\\"";
        else if (c == '\\') o << "\\\\";
        else if ((unsigned char)c < 0x20) o << "\\u" << std::hex << std::setw(4) << std::setfill('0') << (int)c;
        else o << c;
    }
    return o.str();
}

DatabaseManager::DatabaseManager() {
    try {
        driver = sql::mysql::get_mysql_driver_instance();
        connect();
    } catch (sql::SQLException& e) {
        std::cerr << "Init Error: " << e.what() << std::endl;
    }
}

DatabaseManager::~DatabaseManager() {
    if (connection) connection->close();
}

DatabaseManager& DatabaseManager::getInstance() {
    static DatabaseManager instance;
    return instance;
}

void DatabaseManager::connect() {
    try {
        // ★★★ 请确保这里的密码和你的数据库一致 ★★★
        connection.reset(driver->connect("tcp://127.0.0.1:3306", "bank_admin", "BankAdmin123!"));
        connection->setSchema("bank_system");
        std::cout << "数据库连接成功!" << std::endl;
    } catch (sql::SQLException& e) {
        std::cerr << "连接失败: " << e.what() << std::endl;
    }
}

bool DatabaseManager::isConnected() {
    return connection && !connection->isClosed();
}

// 1. 登录
bool DatabaseManager::verifyLogin(const std::string& cardNumber, const std::string& password) {
    std::lock_guard<std::recursive_mutex> lock(db_mutex);
    try {
        if (!isConnected()) connect();
        if (!connection) return false;
        std::unique_ptr<sql::PreparedStatement> pstmt(
            connection->prepareStatement("SELECT card_id FROM cards WHERE card_number = ? AND password_hash = MD5(?) AND status = 'active'")
        );
        pstmt->setString(1, cardNumber);
        pstmt->setString(2, password);
        std::unique_ptr<sql::ResultSet> res(pstmt->executeQuery());
        return res->next();
    } catch (...) { return false; }
}

// 2. 用户信息
std::string DatabaseManager::getUserInfo(const std::string& cardNumber) {
    std::lock_guard<std::recursive_mutex> lock(db_mutex);
    try {
        if (!isConnected()) connect();
        if (!connection) return "{\"status\":\"error\",\"message\":\"数据库未连接\"}";
        std::unique_ptr<sql::PreparedStatement> pstmt(
            connection->prepareStatement("SELECT u.name, u.id_card, u.phone, u.address, c.card_number, c.balance, c.create_time FROM users u JOIN cards c ON u.user_id = c.user_id WHERE c.card_number = ?")
        );
        pstmt->setString(1, cardNumber);
        std::unique_ptr<sql::ResultSet> res(pstmt->executeQuery());

        if (res->next()) {
            std::stringstream ss;
            ss << "{\"status\":\"success\","
               << "\"name\":\"" << escapeJson(res->getString("name")) << "\","
               << "\"id_card\":\"" << escapeJson(res->getString("id_card")) << "\","
               << "\"card_number\":\"" << res->getString("card_number") << "\","
               << "\"phone\":\"" << res->getString("phone") << "\","
               << "\"address\":\"" << escapeJson(res->getString("address")) << "\","
               << "\"balance\":" << std::fixed << std::setprecision(2) << res->getDouble("balance") << ","
               << "\"create_time\":\"" << res->getString("create_time") << "\"}";
            return ss.str();
        }
        return "{\"status\":\"error\",\"message\":\"用户不存在\"}";
    } catch (...) { return "{\"status\":\"error\",\"message\":\"数据库错误\"}"; }
}

// 3. 余额
double DatabaseManager::getBalance(const std::string& cardNumber) {
    std::lock_guard<std::recursive_mutex> lock(db_mutex);
    try {
        if (!isConnected()) connect();
        if (!connection) return -1.0;
        std::unique_ptr<sql::PreparedStatement> pstmt(
            connection->prepareStatement("SELECT balance FROM cards WHERE card_number = ?")
        );
        pstmt->setString(1, cardNumber);
        std::unique_ptr<sql::ResultSet> res(pstmt->executeQuery());
        if (res->next()) return res->getDouble("balance");
        return -1.0;
    } catch (...) { return -1.0; }
}

// 4. 存款
bool DatabaseManager::deposit(const std::string& cardNumber, double amount) {
    std::lock_guard<std::recursive_mutex> lock(db_mutex);
    try {
        if (!isConnected()) connect();
        if (!connection) return false;
        connection->setAutoCommit(false);

        int cardId = 0;
        double newBalance = 0.0;
        {
            std::unique_ptr<sql::PreparedStatement> upd(connection->prepareStatement("UPDATE cards SET balance = balance + ? WHERE card_number = ?"));
            upd->setDouble(1, amount); upd->setString(2, cardNumber);
            if (upd->executeUpdate() == 0) throw sql::SQLException("Card not found");
            std::unique_ptr<sql::PreparedStatement> sel(connection->prepareStatement("SELECT card_id, balance FROM cards WHERE card_number = ?"));
            sel->setString(1, cardNumber);
            std::unique_ptr<sql::ResultSet> res(sel->executeQuery());
            res->next();
            cardId = res->getInt("card_id");
            newBalance = res->getDouble("balance");
        }
        std::unique_ptr<sql::PreparedStatement> log(connection->prepareStatement("INSERT INTO transactions (card_id, type, amount, balance_after, description) VALUES (?, 'deposit', ?, ?, '存款')"));
        log->setInt(1, cardId); log->setDouble(2, amount); log->setDouble(3, newBalance);
        log->executeUpdate();
        connection->commit(); connection->setAutoCommit(true);
        return true;
    } catch (...) {
        if(connection) try{connection->rollback(); connection->setAutoCommit(true);}catch(...){}
        return false;
    }
}

// 5. 取款
bool DatabaseManager::withdraw(const std::string& cardNumber, double amount) {
    std::lock_guard<std::recursive_mutex> lock(db_mutex);
    try {
        if (!isConnected()) connect();
        if (!connection) return false;
        connection->setAutoCommit(false);
        int cardId = 0;
        {
            std::unique_ptr<sql::PreparedStatement> check(connection->prepareStatement("SELECT balance, card_id FROM cards WHERE card_number = ? FOR UPDATE"));
            check->setString(1, cardNumber);
            std::unique_ptr<sql::ResultSet> res(check->executeQuery());
            if (!res->next()) throw sql::SQLException("Not found");
            if (res->getDouble("balance") < amount) throw sql::SQLException("Low balance");
            cardId = res->getInt("card_id");
        }
        std::unique_ptr<sql::PreparedStatement> upd(connection->prepareStatement("UPDATE cards SET balance = balance - ? WHERE card_number = ?"));
        upd->setDouble(1, amount); upd->setString(2, cardNumber);
        upd->executeUpdate();
        std::unique_ptr<sql::PreparedStatement> log(connection->prepareStatement("INSERT INTO transactions (card_id, type, amount, balance_after, description) SELECT card_id, 'withdraw', ?, balance, '取款' FROM cards WHERE card_number = ?"));
        log->setDouble(1, amount); log->setString(2, cardNumber);
        log->executeUpdate();
        connection->commit(); connection->setAutoCommit(true);
        return true;
    } catch (...) {
        if(connection) try{connection->rollback(); connection->setAutoCommit(true);}catch(...){}
        return false;
    }
}

// 6. 交易记录
std::string DatabaseManager::getTransactionHistory(const std::string& cardNumber) {
    std::lock_guard<std::recursive_mutex> lock(db_mutex);
    try {
        if (!isConnected()) connect();
        if (!connection) return "{\"status\":\"error\",\"message\":\"数据库未连接\"}";
        std::unique_ptr<sql::PreparedStatement> pstmt(connection->prepareStatement("SELECT t.type, t.amount, t.balance_after, t.description, t.create_time FROM transactions t JOIN cards c ON t.card_id = c.card_id WHERE c.card_number = ? ORDER BY t.create_time DESC LIMIT 20"));
        pstmt->setString(1, cardNumber);
        std::unique_ptr<sql::ResultSet> res(pstmt->executeQuery());
        std::stringstream ss; ss << "{\"status\":\"success\",\"transactions\":[";
        bool f = true;
        while (res->next()) {
            if (!f) ss << ",";
            ss << "{\"type\":\"" << res->getString("type") << "\",\"amount\":" << std::fixed << std::setprecision(2) << res->getDouble("amount") << ",\"balance_after\":" << std::fixed << std::setprecision(2) << res->getDouble("balance_after") << ",\"description\":\"" << escapeJson(res->getString("description")) << "\",\"create_time\":\"" << res->getString("create_time") << "\"}";
            f = false;
        }
        ss << "]}";
        return ss.str();
    } catch (...) { return "{\"status\":\"error\"}"; }
}

// 7. 检查卡号
bool DatabaseManager::isCardNumberExists(const std::string& cardNumber) {
    std::lock_guard<std::recursive_mutex> lock(db_mutex);
    try {
        if (!isConnected()) connect();
        if (!connection) return false;
        std::unique_ptr<sql::PreparedStatement> pstmt(connection->prepareStatement("SELECT card_id FROM cards WHERE card_number = ?"));
        pstmt->setString(1, cardNumber);
        std::unique_ptr<sql::ResultSet> res(pstmt->executeQuery());
        return res->next();
    } catch (...) { return false; }
}

// 8. 开户
bool DatabaseManager::createAccount(const std::string& name, const std::string& idCard,
                                  const std::string& phone, const std::string& address,
                                  const std::string& cardNumber, const std::string& password,
                                  double initialDeposit) {
    std::lock_guard<std::recursive_mutex> lock(db_mutex);
    try {
        if (!isConnected()) connect();
        if (!connection) return false;
        connection->setAutoCommit(false);
        if (isCardNumberExists(cardNumber)) throw sql::SQLException("Exists");

        std::unique_ptr<sql::PreparedStatement> user(connection->prepareStatement("INSERT INTO users (name, id_card, phone, address) VALUES (?, ?, ?, ?)"));
        user->setString(1, name); user->setString(2, idCard); user->setString(3, phone); user->setString(4, address);
        user->executeUpdate();

        int uid = 0;
        {
            std::unique_ptr<sql::Statement> stmt(connection->createStatement());
            std::unique_ptr<sql::ResultSet> uidRes(stmt->executeQuery("SELECT LAST_INSERT_ID()"));
            uidRes->next(); uid = uidRes->getInt(1);
        }

        std::unique_ptr<sql::PreparedStatement> card(connection->prepareStatement("INSERT INTO cards (user_id, card_number, password_hash, balance) VALUES (?, ?, MD5(?), ?)"));
        card->setInt(1, uid); card->setString(2, cardNumber); card->setString(3, password); card->setDouble(4, initialDeposit);
        card->executeUpdate();

        int cid = 0;
        {
            std::unique_ptr<sql::Statement> stmt(connection->createStatement());
            std::unique_ptr<sql::ResultSet> cidRes(stmt->executeQuery("SELECT LAST_INSERT_ID()"));
            cidRes->next(); cid = cidRes->getInt(1);
        }

        std::unique_ptr<sql::PreparedStatement> trans(connection->prepareStatement("INSERT INTO transactions (card_id, type, amount, balance_after, description) VALUES (?, 'open', ?, ?, '开户')"));
        trans->setInt(1, cid); trans->setDouble(2, initialDeposit); trans->setDouble(3, initialDeposit);
        trans->executeUpdate();

        connection->commit(); connection->setAutoCommit(true);
        return true;
    } catch (...) {
        if(connection) try{connection->rollback(); connection->setAutoCommit(true);}catch(...){}
        return false;
    }
}

// 9. 转账
bool DatabaseManager::transfer(const std::string& from_card, const std::string& to_card, double amount, const std::string& message, bool is_anonymous) {
    std::lock_guard<std::recursive_mutex> lock(db_mutex);
    if (from_card == to_card || amount <= 0) return false;
    try {
        if (!isConnected()) connect();
        if (!connection) return false;
        connection->setAutoCommit(false);

        int srcId = 0;
        int dstId = 0;

        {
            std::unique_ptr<sql::PreparedStatement> src(connection->prepareStatement("SELECT card_id, balance FROM cards WHERE card_number = ? FOR UPDATE"));
            src->setString(1, from_card);
            std::unique_ptr<sql::ResultSet> rs(src->executeQuery());
            if (!rs->next()) throw sql::SQLException("付款人不存在");
            if (rs->getDouble("balance") < amount) throw sql::SQLException("余额不足");
            srcId = rs->getInt("card_id");
        }

        {
            std::unique_ptr<sql::PreparedStatement> dst(connection->prepareStatement("SELECT card_id FROM cards WHERE card_number = ?"));
            dst->setString(1, to_card);
            std::unique_ptr<sql::ResultSet> rd(dst->executeQuery());
            if (!rd->next()) throw sql::SQLException("收款人不存在");
            dstId = rd->getInt("card_id");
        }

        std::unique_ptr<sql::PreparedStatement> upd1(connection->prepareStatement("UPDATE cards SET balance = balance - ? WHERE card_id = ?"));
        upd1->setDouble(1, amount); upd1->setInt(2, srcId); upd1->executeUpdate();

        std::unique_ptr<sql::PreparedStatement> upd2(connection->prepareStatement("UPDATE cards SET balance = balance + ? WHERE card_id = ?"));
        upd2->setDouble(1, amount); upd2->setInt(2, dstId); upd2->executeUpdate();

        // 记录流水 - 使用标准类型 withdraw/deposit
        std::unique_ptr<sql::PreparedStatement> log1(connection->prepareStatement("INSERT INTO transactions (card_id, type, amount, balance_after, description) VALUES (?, 'withdraw', ?, (SELECT balance FROM cards WHERE card_id=?), ?)"));
        log1->setInt(1, srcId); log1->setDouble(2, amount); log1->setInt(3, srcId); log1->setString(4, "转账给 " + to_card); log1->executeUpdate();

        std::string sName = is_anonymous ? "匿名用户" : getUserName(from_card);
        std::unique_ptr<sql::PreparedStatement> log2(connection->prepareStatement("INSERT INTO transactions (card_id, type, amount, balance_after, description) VALUES (?, 'deposit', ?, (SELECT balance FROM cards WHERE card_id=?), ?)"));
        log2->setInt(1, dstId); log2->setDouble(2, amount); log2->setInt(3, dstId); log2->setString(4, "收到 " + sName + " 转账"); log2->executeUpdate();

        std::unique_ptr<sql::PreparedStatement> msg(connection->prepareStatement("INSERT INTO messages (recipient_card, sender_name, type, amount, content) VALUES (?, ?, 'transfer', ?, ?)"));
        msg->setString(1, to_card); msg->setString(2, sName); msg->setDouble(3, amount); msg->setString(4, message); msg->executeUpdate();

        connection->commit(); connection->setAutoCommit(true);
        return true;
    } catch (sql::SQLException& e) {
        std::cerr << "Transfer Error: " << e.what() << std::endl;
        if(connection) try{connection->rollback(); connection->setAutoCommit(true);}catch(...){}
        return false;
    }
}

// 10. 获取姓名
std::string DatabaseManager::getUserName(const std::string& card_number) {
    std::lock_guard<std::recursive_mutex> lock(db_mutex);
    try {
        if (!isConnected()) connect();
        if (!connection) return "";
        std::unique_ptr<sql::PreparedStatement> p(connection->prepareStatement("SELECT u.name FROM users u JOIN cards c ON u.user_id = c.user_id WHERE c.card_number = ?"));
        p->setString(1, card_number);
        std::unique_ptr<sql::ResultSet> r(p->executeQuery());
        if (r->next()) return r->getString("name");
        return "";
    } catch (...) { return ""; }
}

// 11. 获取消息
std::string DatabaseManager::getUserMessages(const std::string& card_number) {
    std::lock_guard<std::recursive_mutex> lock(db_mutex);
    try {
        if (!isConnected()) connect();
        if (!connection) return "{\"status\":\"error\",\"message\":\"数据库未连接\"}";
        std::unique_ptr<sql::PreparedStatement> p(connection->prepareStatement("SELECT id, sender_name, type, amount, content, is_read, create_time FROM messages WHERE recipient_card = ? ORDER BY create_time DESC"));
        p->setString(1, card_number);
        std::unique_ptr<sql::ResultSet> r(p->executeQuery());
        std::stringstream ss; ss << "{\"status\":\"success\",\"messages\":[";
        bool f = true;
        while (r->next()) {
            if (!f) ss << ",";
            ss << "{\"id\":" << r->getInt("id") << ",\"sender_name\":\"" << escapeJson(r->getString("sender_name"))
               << "\",\"type\":\"" << r->getString("type") << "\",\"amount\":" << r->getDouble("amount")
               << ",\"content\":\"" << escapeJson(r->getString("content")) << "\",\"is_read\":" << r->getInt("is_read")
               << ",\"create_time\":\"" << r->getString("create_time") << "\"}";
            f = false;
        }
        ss << "]}";
        return ss.str();
    } catch (...) { return "{\"status\":\"error\"}"; }
}

// 12. 标记已读
bool DatabaseManager::markMessageRead(int message_id) {
    std::lock_guard<std::recursive_mutex> lock(db_mutex);
    try {
        if (!isConnected()) connect();
        if (!connection) return false;
        std::unique_ptr<sql::PreparedStatement> p(connection->prepareStatement("UPDATE messages SET is_read = 1 WHERE id = ?"));
        p->setInt(1, message_id);
        return p->executeUpdate() > 0;
    } catch (...) { return false; }
}

// 13. 发送系统消息
bool DatabaseManager::sendSystemMessage(const std::string& to_card, const std::string& title, const std::string& content) {
    std::lock_guard<std::recursive_mutex> lock(db_mutex);
    try {
        if (!isConnected()) connect();
        if (!connection) return false;
        std::unique_ptr<sql::PreparedStatement> p(connection->prepareStatement("INSERT INTO messages (recipient_card, sender_name, type, amount, content) VALUES (?, '系统通知', 'system', 0, ?)"));
        p->setString(1, to_card); p->setString(2, content);
        return p->executeUpdate() > 0;
    } catch (...) { return false; }
}

// 14. 更新用户信息
bool DatabaseManager::updateUserInfo(const std::string& cardNumber, const std::string& name, const std::string& idCard, const std::string& phone, const std::string& address) {
    std::lock_guard<std::recursive_mutex> lock(db_mutex);
    try {
        if (!isConnected()) connect();
        if (!connection) return false;

        // 通过卡号找 user_id
        std::unique_ptr<sql::PreparedStatement> findUser(
            connection->prepareStatement("SELECT user_id FROM cards WHERE card_number = ?")
        );
        findUser->setString(1, cardNumber);
        std::unique_ptr<sql::ResultSet> res(findUser->executeQuery());
        if (!res->next()) return false;
        int userId = res->getInt("user_id");

        // 更新 users 表
        std::unique_ptr<sql::PreparedStatement> update(
            connection->prepareStatement("UPDATE users SET name = ?, id_card = ?, phone = ?, address = ? WHERE user_id = ?")
        );
        update->setString(1, name);
        update->setString(2, idCard);
        update->setString(3, phone);
        update->setString(4, address);
        update->setInt(5, userId);

        return update->executeUpdate() > 0;
    } catch (sql::SQLException& e) {
        std::cerr << "Update User Error: " << e.what() << std::endl;
        return false;
    }
}

// 15. 验证身份 (忘记密码)
bool DatabaseManager::verifyIdentity(const std::string& cardNumber, const std::string& name, const std::string& phone) {
    std::lock_guard<std::recursive_mutex> lock(db_mutex);
    try {
        if (!isConnected()) connect();
        if (!connection) return false;
        std::unique_ptr<sql::PreparedStatement> p(connection->prepareStatement(
            "SELECT c.card_id FROM cards c JOIN users u ON c.user_id = u.user_id WHERE c.card_number = ? AND u.name = ? AND u.phone = ?"
        ));
        p->setString(1, cardNumber); p->setString(2, name); p->setString(3, phone);
        std::unique_ptr<sql::ResultSet> rs(p->executeQuery());
        return rs->next();
    } catch (...) { return false; }
}

// 16. 修改密码 (使用MD5加密)
bool DatabaseManager::updatePassword(const std::string& cardNumber, const std::string& newPassword) {
    std::lock_guard<std::recursive_mutex> lock(db_mutex);
    try {
        if (!isConnected()) connect();
        if (!connection) return false;
        std::unique_ptr<sql::PreparedStatement> p(connection->prepareStatement("UPDATE cards SET password_hash = MD5(?) WHERE card_number = ?"));
        p->setString(1, newPassword); p->setString(2, cardNumber);
        return p->executeUpdate() > 0;
    } catch (...) { return false; }
}
