#ifndef SETTINGSWINDOW_H
#define SETTINGSWINDOW_H

#include <QDialog>

namespace Ui {
class settingswindow;
}

class settingswindow : public QDialog
{
    Q_OBJECT

public:
    explicit settingswindow(QWidget *parent = nullptr);
    ~settingswindow();

private:
    Ui::settingswindow *ui;
};

#endif // SETTINGSWINDOW_H
