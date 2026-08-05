#ifndef SYNTAXHIGHLITHER_H
#define SYNTAXHIGHLITHER_H

#include <QSyntaxHighlighter>
#include <QTextCharFormat>
#include <QRegularExpression>
#include <QStringList>


class SyntaxHighlighter : public QSyntaxHighlighter
{
public:
    explicit SyntaxHighlighter(QTextDocument *parent = nullptr);


protected:
    void highlightBlock(const QString &text) override;


private:

    QTextCharFormat keywordFormat;
    QTextCharFormat stringFormat;
    QTextCharFormat commentFormat;
    QTextCharFormat numberFormat;

    QStringList keywords;
};


#endif