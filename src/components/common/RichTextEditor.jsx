import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Link from '@tiptap/extension-link';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { Box, Button, Popover, Stack, TextField, Typography } from '@mui/material';
import TableChartIcon from '@mui/icons-material/TableChart';
import {
  RichTextEditor as MuiRichTextEditor,
  MenuControlsContainer,
  MenuDivider,
  MenuSelectHeading,
  MenuSelectTextAlign,
  MenuButtonBold,
  MenuButtonItalic,
  MenuButtonUnderline,
  MenuButtonStrikethrough,
  MenuButtonTextColor,
  MenuButtonHighlightColor,
  MenuButtonEditLink,
  MenuButtonOrderedList,
  MenuButtonBulletedList,
  MenuButtonImageUpload,
  MenuButtonRemoveFormatting,
  MenuButtonUndo,
  MenuButtonRedo,
  MenuButton,
  LinkBubbleMenu,
  LinkBubbleMenuHandler,
  TableBubbleMenu,
  TableImproved,
  ResizableImage,
  useRichTextEditorContext,
} from 'mui-tiptap';

const GRID_MAX = 8; // 그리드 선택기 최대 행/열

// 표 삽입 전 행/열 개수를 그리드에서 고르는 버튼 (구글독스 스타일)
function TableInsertButton() {
  const editor = useRichTextEditorContext();
  const [anchorEl, setAnchorEl] = useState(null);
  const [hover, setHover] = useState({ rows: 0, cols: 0 });
  const open = Boolean(anchorEl);

  const close = () => {
    setAnchorEl(null);
    setHover({ rows: 0, cols: 0 });
  };

  const insert = (rows, cols) => {
    editor?.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
    close();
  };

  return (
    <>
      <MenuButton
        tooltipLabel="표 삽입 (행·열 선택)"
        IconComponent={TableChartIcon}
        onClick={(e) => setAnchorEl(e.currentTarget)}
        selected={open}
        disabled={!editor?.isEditable}
      />
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ p: 1.5 }}>
          <Typography variant="body2" align="center" sx={{ mb: 1, fontWeight: 600 }}>
            {hover.rows > 0
              ? `${hover.rows} × ${hover.cols} 표`
              : '드래그하여 칸 수 선택'}
          </Typography>
          <Box
            sx={{ display: 'flex', flexDirection: 'column', gap: '3px' }}
            onMouseLeave={() => setHover({ rows: 0, cols: 0 })}
          >
            {Array.from({ length: GRID_MAX }).map((_, r) => (
              <Box key={r} sx={{ display: 'flex', gap: '3px' }}>
                {Array.from({ length: GRID_MAX }).map((_, c) => {
                  const active = r < hover.rows && c < hover.cols;
                  return (
                    <Box
                      key={c}
                      onMouseEnter={() => setHover({ rows: r + 1, cols: c + 1 })}
                      onClick={() => insert(r + 1, c + 1)}
                      sx={{
                        width: 18,
                        height: 18,
                        border: '1px solid',
                        borderColor: active ? 'primary.main' : 'divider',
                        bgcolor: active ? 'primary.light' : 'transparent',
                        cursor: 'pointer',
                        borderRadius: '2px',
                      }}
                    />
                  );
                })}
              </Box>
            ))}
          </Box>
        </Box>
      </Popover>
    </>
  );
}

const tableBubbleLabels = {
  insertColumnBefore: '왼쪽에 열 추가',
  insertColumnAfter: '오른쪽에 열 추가',
  deleteColumn: '열 삭제',
  insertRowBefore: '위에 행 추가',
  insertRowAfter: '아래에 행 추가',
  deleteRow: '행 삭제',
  mergeCells: '셀 병합',
  splitCell: '셀 분할',
  toggleHeaderRow: '머리글 행 전환',
  toggleHeaderColumn: '머리글 열 전환',
  deleteTable: '표 삭제',
};

const linkBubbleLabels = {
  editLinkAddTitle: '링크 추가',
  editLinkEditTitle: '링크 편집',
  editLinkTextInputLabel: '표시 텍스트',
  editLinkHrefInputLabel: 'URL',
  editLinkSaveButtonLabel: '저장',
  editLinkCancelButtonLabel: '취소',
  viewLinkEditButtonLabel: '편집',
  viewLinkRemoveButtonLabel: '제거',
};

/**
 * 게시판 본문용 리치 텍스트 에디터 (TipTap 기반).
 * - HTML 입력/출력 무손실: value(HTML) → 초기 content, 변경 시 onChange(HTML)
 * - 표: 행/열 그리드로 크기 선택 후 삽입, 에디터 안에서 직접 보고 편집(행·열 추가/삭제)
 * - 이미지: onImageUpload(File)=>url 제공 시 업로드 후 본문에 <img> 삽입
 *
 * 주의: value는 "초기값"으로만 사용된다(비제어). 비동기로 불러오는 경우
 *       데이터 로드 완료 후 마운트할 것(예: BoardEdit의 loading 가드).
 */
const RichTextEditor = forwardRef(function RichTextEditor(
  {
    value = '',
    onChange,
    onImageUpload,
    placeholder = '내용을 입력하세요...',
    minHeight = 280,
    enableTable = true,
    enableImage = true,
    enableHtmlMode = false,
    initialHtmlMode = false,
  },
  ref
) {
  const rteRef = useRef(null);
  const [htmlMode, setHtmlMode] = useState(initialHtmlMode);
  const [htmlText, setHtmlText] = useState(initialHtmlMode ? value : '');

  // 에디터(WYSIWYG) ↔ HTML 원본 모드 전환
  const toggleHtmlMode = () => {
    const editor = rteRef.current?.editor;
    if (!htmlMode) {
      // WYSIWYG → HTML: 현재 에디터 HTML을 원본으로
      setHtmlText(editor?.getHTML() ?? value ?? '');
      setHtmlMode(true);
    } else {
      // HTML → WYSIWYG: 원본을 에디터에 반영(미지원 태그는 제거될 수 있음)
      editor?.commands.setContent(htmlText || '', true);
      setHtmlMode(false);
    }
  };

  useImperativeHandle(ref, () => ({
    // 외부에서 HTML 삽입(파일 첨부 등). HTML 모드면 원본 textarea 끝에, 아니면 에디터 커서에.
    insertContent: (html) => {
      if (htmlMode) {
        setHtmlText((prev) => {
          const next = (prev || '') + html;
          onChange?.(next);
          return next;
        });
      } else {
        rteRef.current?.editor?.chain().focus().insertContent(html).run();
      }
    },
    getHTML: () => rteRef.current?.editor?.getHTML() ?? '',
    // 저장용 권위 콘텐츠: HTML 모드면 원본 textarea, 아니면 에디터 HTML
    getContent: () => (htmlMode ? htmlText : (rteRef.current?.editor?.getHTML() ?? '')),
    // 현재 HTML 모드 여부 — 저장 시 is_html 플래그 기록용
    isHtmlMode: () => htmlMode,
    get editor() {
      return rteRef.current?.editor ?? null;
    },
  }));

  // 외부에서 value가 바뀌면(탭 전환·비동기 로드) 에디터 내용 동기화. 타이핑·HTML모드 중에는 no-op.
  useEffect(() => {
    if (htmlMode) return;
    const editor = rteRef.current?.editor;
    if (!editor) return;
    if (value === editor.getHTML()) return;
    editor.commands.setContent(value || '', false);
  }, [value, htmlMode]);

  const extensions = [
    StarterKit,
    Underline,
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Link.configure({ autolink: true, linkOnPaste: true, openOnClick: false }),
    LinkBubbleMenuHandler,
    ...(enableImage ? [ResizableImage] : []),
    ...(enableTable ? [TableImproved.configure({ resizable: true }), TableRow, TableHeader, TableCell] : []),
  ];

  const handleUploadFiles = async (files) => {
    const results = [];
    for (const file of files) {
      try {
        const src = onImageUpload ? await onImageUpload(file) : URL.createObjectURL(file);
        if (src) results.push({ src, alt: file.name });
      } catch (err) {
        console.error('이미지 업로드 오류:', err);
      }
    }
    return results;
  };

  return (
    <Box>
      {enableHtmlMode && (
        <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
          <Button size="small" variant="outlined" onClick={toggleHtmlMode}>
            {htmlMode ? '에디터 모드' : 'HTML 모드'}
          </Button>
        </Stack>
      )}

      <Box
        sx={{
          display: htmlMode ? 'none' : 'block',
          '& .ProseMirror': { minHeight },
          // 에디터 안 표 테두리(저장 후 상세화면 CSS와 동일 톤)
          '& .ProseMirror table': { borderCollapse: 'collapse', width: '100%', margin: '8px 0' },
          '& .ProseMirror th, & .ProseMirror td': { border: '1px solid #ccc', padding: '8px', minWidth: '1em' },
          '& .ProseMirror th': { background: '#f5f5f5', fontWeight: 600 },
          '& .ProseMirror img': { maxWidth: '100%', height: 'auto', borderRadius: 4 },
        }}
      >
        <MuiRichTextEditor
        ref={rteRef}
        extensions={extensions}
        content={value}
        editable
        onUpdate={({ editor }) => { if (!htmlMode) onChange?.(editor.getHTML()); }}
        editorProps={{ attributes: { 'data-placeholder': placeholder } }}
        RichTextFieldProps={{ variant: 'outlined' }}
        renderControls={() => (
          <MenuControlsContainer>
            <MenuSelectHeading />
            <MenuDivider />
            <MenuButtonBold />
            <MenuButtonItalic />
            <MenuButtonUnderline />
            <MenuButtonStrikethrough />
            <MenuDivider />
            <MenuButtonTextColor />
            <MenuButtonHighlightColor />
            <MenuDivider />
            <MenuButtonEditLink />
            <MenuSelectTextAlign />
            <MenuDivider />
            <MenuButtonOrderedList />
            <MenuButtonBulletedList />
            {(enableTable || enableImage) && <MenuDivider />}
            {enableTable && <TableInsertButton />}
            {enableImage && <MenuButtonImageUpload onUploadFiles={handleUploadFiles} />}
            <MenuDivider />
            <MenuButtonRemoveFormatting />
            <MenuButtonUndo />
            <MenuButtonRedo />
          </MenuControlsContainer>
        )}
      >
        {() => (
          <>
            <LinkBubbleMenu labels={linkBubbleLabels} />
            {enableTable && <TableBubbleMenu labels={tableBubbleLabels} />}
          </>
        )}
      </MuiRichTextEditor>
      </Box>

      {htmlMode && (
        <TextField
          label="HTML 원본"
          value={htmlText}
          onChange={(e) => { setHtmlText(e.target.value); onChange?.(e.target.value); }}
          fullWidth
          multiline
          minRows={12}
          helperText="HTML 원본을 직접 편집합니다. '에디터 모드'로 돌아가면 에디터가 지원하지 않는 태그(iframe·style·script 등)는 제거될 수 있습니다. 원본 그대로 저장하려면 HTML 모드에서 저장하세요."
        />
      )}
    </Box>
  );
});

export default RichTextEditor;
