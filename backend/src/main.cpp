#include "../include/crow_all.h"
#include "../include/DatabaseManager.h"
#include <iostream>
#include <unistd.h>
#include <fstream>
#include <sstream>
#include <iomanip>

// 获取项目绝对路径
std::string getProjectRoot() {
    char cwd[PATH_MAX];
    if (getcwd(cwd, sizeof(cwd)) != NULL) {
        std::string path(cwd);
        size_t build_pos = path.find("/backend/build");
        if (build_pos != std::string::npos) {
            path = path.substr(0, build_pos);
        }
        return path;
    }
    return "/home/aoalas/bank_system";
}

// 手动读取文件内容
std::string readFile(const std::string& path) {
    std::ifstream file(path);
    if (!file.is_open()) {
        return "文件未找到: " + path;
    }
    std::stringstream buffer;
    buffer << file.rdbuf();
    return buffer.str();
}

int main() {
    crow::SimpleApp app;

    std::string project_root = getProjectRoot();
    std::cout << "项目根目录: " << project_root << std::endl;

    std::cout << "银行系统后端服务启动中..." << std::endl;
    // 确保数据库连接初始化
    DatabaseManager::getInstance();

    // 静态文件服务
    CROW_ROUTE(app, "/")
    ([project_root]() {
        std::string file_path = project_root + "/frontend/html/login.html";
        std::string content = readFile(file_path);
        crow::response response;
        response.write(content);
        response.add_header("Content-Type", "text/html; charset=utf-8");
        return response;
    });

    CROW_ROUTE(app, "/<string>")
    ([project_root](const std::string& filename) {
        std::string file_path = project_root + "/frontend/html/" + filename;
        std::string content = readFile(file_path);
        crow::response response;
        response.write(content);
        response.add_header("Content-Type", "text/html; charset=utf-8");
        return response;
    });

    CROW_ROUTE(app, "/css/<string>")
    ([project_root](const std::string& filename) {
        std::string file_path = project_root + "/frontend/css/" + filename;
        std::string content = readFile(file_path);
        crow::response response;
        response.write(content);
        response.add_header("Content-Type", "text/css");
        return response;
    });

    CROW_ROUTE(app, "/js/<string>")
    ([project_root](const std::string& filename) {
        std::string file_path = project_root + "/frontend/js/" + filename;
        std::string content = readFile(file_path);
        crow::response response;
        response.write(content);
        response.add_header("Content-Type", "application/javascript");
        return response;
    });

    // === API 接口 ===

    CROW_ROUTE(app, "/api/userinfo/<string>")
    ([](const std::string& card_number) {
        std::string userInfo = DatabaseManager::getInstance().getUserInfo(card_number);
        crow::response response(200, userInfo);
        response.add_header("Content-Type", "application/json");
        return response;
    });

    CROW_ROUTE(app, "/api/login").methods("POST"_method)
    ([](const crow::request& req) {
        auto json = crow::json::load(req.body);
        if (!json) return crow::response(400, "无效的JSON数据");

        std::string card_number = json["card_number"].s();
        std::string password = json["password"].s();

        bool success = DatabaseManager::getInstance().verifyLogin(card_number, password);

        crow::json::wvalue response;
        if (success) {
            response["status"] = "success";
            response["message"] = "登录成功";
        } else {
            response["status"] = "error";
            response["message"] = "卡号或密码错误";
        }
        return crow::response(200, response);
    });

    // 修改密码 (需验证旧密码)
    CROW_ROUTE(app, "/api/password/change").methods("POST"_method)([](const crow::request& req) {
        auto json = crow::json::load(req.body);
        std::string card = json["card_number"].s();
        // 先验证旧密码
        if(DatabaseManager::getInstance().verifyLogin(card, json["old_password"].s())) {
            bool ok = DatabaseManager::getInstance().updatePassword(card, json["new_password"].s());
            return crow::response(200, ok ? "{\"status\":\"success\"}" : "{\"status\":\"error\"}");
        }
        return crow::response(200, "{\"status\":\"error\",\"message\":\"旧密码错误\"}");
    });

    // 重置密码 (验证身份信息)
    CROW_ROUTE(app, "/api/password/reset").methods("POST"_method)([](const crow::request& req) {
        auto json = crow::json::load(req.body);
        std::string card = json["card_number"].s();
        if(DatabaseManager::getInstance().verifyIdentity(card, json["name"].s(), json["phone"].s())) {
            bool ok = DatabaseManager::getInstance().updatePassword(card, json["new_password"].s());
            return crow::response(200, ok ? "{\"status\":\"success\"}" : "{\"status\":\"error\"}");
        }
        return crow::response(200, "{\"status\":\"error\",\"message\":\"身份信息验证失败\"}");
    });

    // === 新增：销户验证 ===
    CROW_ROUTE(app, "/api/account/check").methods("POST"_method)([](const crow::request& req) {
        auto json = crow::json::load(req.body);
        std::string card = json["card_number"].s();

        double balance = 0.0;
        bool ok = DatabaseManager::getInstance().checkAccountForDeletion(
            card, json["name"].s(), json["phone"].s(), balance
        );

        if (ok) {
            crow::json::wvalue res;
            res["status"] = "success";
            res["balance"] = balance;
            return crow::response(200, res);
        }
        return crow::response(200, "{\"status\":\"error\",\"message\":\"信息不匹配\"}");
    });

    // === 新增：执行销户 ===
    CROW_ROUTE(app, "/api/account/delete").methods("POST"_method)([](const crow::request& req) {
        auto json = crow::json::load(req.body);
        std::string card = json["card_number"].s();
        bool success = DatabaseManager::getInstance().deleteAccount(card);
        return crow::response(200, success ? "{\"status\":\"success\"}" : "{\"status\":\"error\"}");
    });

    CROW_ROUTE(app, "/api/balance/<string>")
    ([](const std::string& card_number) {
        double balance = DatabaseManager::getInstance().getBalance(card_number);
        crow::json::wvalue response;
        if (balance >= 0) {
            response["status"] = "success";
            response["balance"] = balance;
        } else {
            response["status"] = "error";
            response["message"] = "查询失败";
        }
        return crow::response(200, response);
    });

    CROW_ROUTE(app, "/api/deposit").methods("POST"_method)
    ([](const crow::request& req) {
        auto json = crow::json::load(req.body);
        if (!json) return crow::response(400, "无效数据");

        std::string card_number = json["card_number"].s();
        double amount = json["amount"].d();

        bool success = DatabaseManager::getInstance().deposit(card_number, amount);

        crow::json::wvalue response;
        if (success) {
            response["status"] = "success";
            response["message"] = "存款成功";
        } else {
            response["status"] = "error";
            response["message"] = "存款失败";
        }
        return crow::response(200, response);
    });

    CROW_ROUTE(app, "/api/withdraw").methods("POST"_method)
    ([](const crow::request& req) {
        auto json = crow::json::load(req.body);
        if (!json) return crow::response(400, "无效数据");

        std::string card_number = json["card_number"].s();
        double amount = json["amount"].d();

        bool success = DatabaseManager::getInstance().withdraw(card_number, amount);

        crow::json::wvalue response;
        if (success) {
            response["status"] = "success";
            response["message"] = "取款成功";
        } else {
            response["status"] = "error";
            response["message"] = "余额不足或操作失败";
        }
        return crow::response(200, response);
    });

    CROW_ROUTE(app, "/api/transactions/<string>")
    ([](const std::string& card_number) {
        std::string history = DatabaseManager::getInstance().getTransactionHistory(card_number);
        crow::response response(200, history);
        response.add_header("Content-Type", "application/json");
        return response;
    });

    CROW_ROUTE(app, "/api/check-card/<string>")
    ([](const std::string& card_number) {
        bool exists = DatabaseManager::getInstance().isCardNumberExists(card_number);
        crow::json::wvalue response;
        response["status"] = "success";
        response["available"] = !exists;
        return crow::response(200, response);
    });

    CROW_ROUTE(app, "/api/register").methods("POST"_method)
    ([](const crow::request& req) {
        auto json = crow::json::load(req.body);
        if (!json) return crow::response(400, "无效数据");

        std::string name = json["name"].s();
        std::string id_card = json["id_card"].s();
        std::string phone = json["phone"].s();
        std::string address = json["address"].s();
        std::string card_number = json["card_number"].s();
        std::string password = json["password"].s();
        double initial_deposit = json["initial_deposit"].d();

        bool success = DatabaseManager::getInstance().createAccount(
            name, id_card, phone, address, card_number, password, initial_deposit
        );

        crow::json::wvalue response;
        if (success) {
            response["status"] = "success";
            response["message"] = "开户成功";
            // 发送欢迎消息
            DatabaseManager::getInstance().sendSystemMessage(card_number, "开户成功", "欢迎使用银行储蓄系统！");
        } else {
            response["status"] = "error";
            response["message"] = "开户失败，请检查信息";
        }
        return crow::response(200, response);
    });

    //查询用户姓名 API
    CROW_ROUTE(app, "/api/user/name/<string>")
    ([](const std::string& card_number) {
        std::string name = DatabaseManager::getInstance().getUserName(card_number);
        crow::json::wvalue response;
        if (!name.empty()) {
            response["status"] = "success";
            response["name"] = name;
        } else {
            response["status"] = "error";
            response["message"] = "用户不存在";
        }
        return crow::response(200, response);
    });

    CROW_ROUTE(app, "/api/user/update").methods("POST"_method)([](const crow::request& req) {
            auto json = crow::json::load(req.body);
            if(!json) return crow::response(400);
            bool success = DatabaseManager::getInstance().updateUserInfo(
                json["card_number"].s(), json["name"].s(), json["id_card"].s(), json["phone"].s(), json["address"].s()
            );
            return crow::response(200, success ? "{\"status\":\"success\"}" : "{\"status\":\"error\"}");
        });

    //转账 API
    CROW_ROUTE(app, "/api/transfer").methods("POST"_method)
    ([](const crow::request& req) {
        auto json = crow::json::load(req.body);
        if (!json) return crow::response(400, "无效JSON");

        std::string from_card = json["from_card"].s();
        std::string to_card = json["to_card"].s();
        double amount = json["amount"].d();

        // 修复：安全的字符串获取
        std::string message = "";
        if (json.has("message")) {
            // 强制转换为 string
            std::ostringstream os;
            os << json["message"].s();
            message = os.str();
        }

        bool is_anonymous = false;
        if (json.has("is_anonymous")) {
            is_anonymous = json["is_anonymous"].b();
        }

        bool success = DatabaseManager::getInstance().transfer(from_card, to_card, amount, message, is_anonymous);

        crow::json::wvalue response;
        if (success) {
            response["status"] = "success";
            response["message"] = "转账成功";
        } else {
            response["status"] = "error";
            response["message"] = "转账失败：余额不足或卡号无效";
        }
        return crow::response(200, response);
    });

    //获取消息列表 API
    CROW_ROUTE(app, "/api/messages/<string>")
    ([](const std::string& card_number) {
        std::string msgs = DatabaseManager::getInstance().getUserMessages(card_number);
        crow::response response(200, msgs);
        response.add_header("Content-Type", "application/json");
        return response;
    });

    //标记消息已读 API
    CROW_ROUTE(app, "/api/messages/read").methods("POST"_method)
    ([](const crow::request& req) {
        auto json = crow::json::load(req.body);
        if (!json) return crow::response(400, "无效");
        int msg_id = json["id"].i();
        DatabaseManager::getInstance().markMessageRead(msg_id);
        return crow::response(200, "{\"status\":\"success\"}");
    });

    CROW_ROUTE(app, "/health")([](){ return "OK"; });

    std::cout << "服务启动在端口 18080" << std::endl;
    app.port(18080).multithreaded().run();
    return 0;
}