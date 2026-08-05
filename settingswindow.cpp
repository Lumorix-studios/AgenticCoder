#include "settingswindow.h"
#include "ui_settingswindow.h"

settingswindow::settingswindow(QWidget *parent)
    : QDialog(parent)
    , ui(new Ui::settingswindow)
{
    ui->setupUi(this);
    ui->lineEdit->setPlaceholderText("Set api key");
    ui->lineEdit_2->setPlaceholderText("Set api url endpoint");

}

settingswindow::~settingswindow()
{
    delete ui;
}
