#include "settingswindow.h"
#include "ui_settingswindow.h"

#include <QMessageBox>

settingswindow::settingswindow(QWidget *parent)
    : QDialog(parent)
    , ui(new Ui::settingswindow)
{
    ui->setupUi(this);

    ui->lineEdit->setPlaceholderText("Set API key");
    ui->lineEdit_2->setPlaceholderText("Set API URL endpoint");

    // Apply changes button for tab 1
    connect(
        ui->applytab1,
        &QPushButton::clicked,
        this,
        []()
        {
            QMessageBox::information(
                nullptr,
                "Settings",
                "Settings Saved"
                );
        }
        );

    // Cancel button for tab 1
    connect(
        ui->ctab1,
        &QPushButton::clicked,
        this,
        &settingswindow::close
        );

    // Apply button for tab 2
    connect(
        ui->apply2,
        &QPushButton::clicked,
        this,
        []()
        {
            QMessageBox::information(
                nullptr,
                "Settings",
                "Settings Saved"
                );
        }
        );

    // Cancel button for tab 2
    connect(
        ui->cancel2,
        &QPushButton::clicked,
        this,
        &settingswindow::close
        );

    // Save API key
    connect(
        ui->pushButton,
        &QPushButton::clicked,
        this,
        []()
        {
            QMessageBox::information(
                nullptr,
                "API Key",
                "Key Saved and Configured"
                );
        }
        );

    // Save API URL endpoint
    connect(
        ui->pushButton_2,
        &QPushButton::clicked,
        this,
        []()
        {
            QMessageBox::information(
                nullptr,
                "API URL Endpoint",
                "Saved"
                );
        }
        );
}

settingswindow::~settingswindow()
{
    delete ui;
}