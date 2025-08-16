# feat: Add XLSX support for large file imports (417MB→30MB optimization)

## 🎯 Problem Solved
- CSV import was failing with 417MB files (exceeded Supabase 50MB limit)
- Users needed to import large emission factor datasets from Base Carbone

## ✅ Solution: XLSX Support  
- **93% size reduction:** 417MB CSV → 30MB XLSX
- **No server config changes** needed
- **Seamless user experience** supporting both CSV and XLSX formats

## 🔧 Technical Changes

### Frontend (`src/components/admin/AdminImportsPanel.tsx`)
- ✅ Accept `.xlsx` files in file input with proper MIME types
- ✅ Preserve original extension (.csv/.xlsx) in filename sanitization  
- ✅ Updated tooltip to mention XLSX support for large files
- ✅ Enhanced debug logging for upload transformation

### Backend (`supabase/functions/import-csv/index.ts`)
- ✅ Add XLSX parsing with `xlsx@0.18.5` library via ESM
- ✅ Auto-detect file type (.csv vs .xlsx) by URL analysis
- ✅ Convert XLSX to CSV internally using `XLSX.utils.sheet_to_csv()`
- ✅ Unified `readFileLines()` function handling both formats
- ✅ Comprehensive error handling and logging

### Infrastructure
- ✅ Configure Supabase Storage bucket to allow XLSX MIME types
- ✅ Maintain existing CSV processing pipeline
- ✅ No breaking changes to existing functionality

## 🧪 Testing Results
- ✅ Upload 30MB XLSX file successfully (vs 417MB CSV failure)
- ✅ Backend XLSX parsing and CSV conversion works correctly
- ✅ Import process handles XLSX data identical to CSV
- ✅ File sanitization preserves extensions properly
- ✅ Authentication and storage policies function correctly

## 📊 Performance Impact
- **File size:** 417MB → 30MB (93% reduction)
- **Upload time:** ~30s vs previous timeout
- **Processing:** Identical performance after XLSX→CSV conversion
- **Storage cost:** Significant reduction due to smaller files

## 🔍 Code Quality
- ✅ TypeScript compatibility with Deno runtime
- ✅ Error handling for malformed XLSX files
- ✅ Backward compatibility with existing CSV imports
- ✅ Clear logging for debugging upload issues

## 🎉 Impact
This change resolves the critical blocker for importing large emission factor datasets, enabling users to work with realistic file sizes while maintaining all existing functionality.
