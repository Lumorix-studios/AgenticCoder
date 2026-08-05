#include "mainwindow.h"
#include "ui_mainwindow.h"
#include "settingswindow.h"
#include <QDebug>
#include <QFileDialog>
#include <QMessageBox>

MainWindow::MainWindow(QWidget *parent)
    : QMainWindow(parent)
    , ui(new Ui::MainWindow)
{
    ui->setupUi(this);

    ui->textEdit_2->setPlaceholderText("Send a command/message...");
    ui->textEdit_3->setPlaceholderText("initialize");

    connect(
        ui->actionopen_settings,
        &QAction::triggered,
        this,
        [this]()
        {
            settingswindow *settings = new settingswindow(this);
            settings->show();

        }
        );
}

MainWindow::~MainWindow()
{
    delete ui;
}