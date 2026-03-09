import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import useStore from '../stores/useStore';

export default function RankingTable() {
  const rankings = useStore((s) => s.rankings);
  const rankingsTime = useStore((s) => s.rankingsTime);

  const timeStr = rankingsTime ? new Date(rankingsTime).toLocaleTimeString() : '--';

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle2" color="primary">
            实时排名
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {timeStr}
          </Typography>
        </Box>

        <TableContainer sx={{ flex: 1 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>排名</TableCell>
                <TableCell>广告ID</TableCell>
                <TableCell>用户</TableCell>
                <TableCell align="right">价格(U/天)</TableCell>
                <TableCell align="center">标记</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rankings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                      暂无数据，请先导航或刷新
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                rankings.map((r, i) => (
                  <TableRow
                    key={i}
                    sx={{
                      bgcolor: r.isMine ? 'rgba(46, 204, 113, 0.08)' : 'transparent',
                    }}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={r.isMine ? 700 : 400}>
                        #{r.rank}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{r.adId}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {r.userId}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" color="secondary" fontWeight={700}>
                        {r.price}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      {r.isMine && (
                        <Chip label="我的" size="small" color="success" variant="outlined" />
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}
