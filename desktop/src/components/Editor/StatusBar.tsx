export function StatusBar({
  wordCount, lineCount, saveStatus,
}: {
  wordCount: number;
  lineCount: number;
  saveStatus: 'saved' | 'saving';
}) {
  return (
    <div className="status-bar">
      <div className="left">
        <span>字数: {wordCount}</span>
        <span>行: {lineCount}</span>
      </div>
      <div className="save-indicator">
        <span className={`save-dot ${saveStatus}`} />
        <span>{saveStatus === 'saved' ? '已保存' : '保存中...'}</span>
      </div>
      <div className="right">
        <span>最后编辑: 刚刚</span>
      </div>
    </div>
  );
}
