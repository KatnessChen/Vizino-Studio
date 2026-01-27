import { Empty } from 'antd';

type MyEmptyProps = {
  description?: string;
  image?: React.ReactNode;
};

const MyEmpty = ({ description, image = Empty.PRESENTED_IMAGE_SIMPLE }: MyEmptyProps) => {
  return <Empty description={description} image={image} style={{ margin: 0 }} />;
};

export default MyEmpty;
